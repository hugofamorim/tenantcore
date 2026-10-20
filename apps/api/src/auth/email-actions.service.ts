import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { EmailActionPurpose } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from './password.service';
import { MailService } from './mail.service';
import { isSecret, newSecret, tokenHash } from './auth.tokens';

export const EMAIL_REQUEST_MESSAGE =
  'If this account is eligible, an email will arrive shortly. Check your inbox or try again in a minute.';
export const EMAIL_ACTION_ERROR =
  'This link is invalid or expired. Please request a new email.';
export const EMAIL_ACTION_COOLDOWN_MS = 60_000;

type EmailJob = { email: string; purpose: EmailActionPurpose };

@Injectable()
export class EmailActionsService implements OnModuleDestroy {
  private readonly logger = new Logger(EmailActionsService.name);
  private readonly jobs: EmailJob[] = [];
  private readonly idle: Array<() => void> = [];
  private running = 0;
  private stopping = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly mail: MailService,
  ) {}

  request(email: string, purpose: EmailActionPurpose) {
    if (!this.stopping && this.jobs.length + this.running < 32) {
      this.jobs.push({ email, purpose });
      setImmediate(() => this.start());
    } else this.logger.warn('Account email queue unavailable; resend required');
    return { message: EMAIL_REQUEST_MESSAGE };
  }

  private start() {
    while (this.running < 2 && this.jobs.length > 0) {
      const job = this.jobs.shift();
      if (!job) break;
      this.running++;
      void this.deliver(job)
        .catch(() => {
          this.logger.warn('Account email delivery failed; resend required');
        })
        .finally(() => {
          this.running--;
          this.start();
          if (this.running === 0 && this.jobs.length === 0)
            this.idle.splice(0).forEach((resolve) => resolve());
        });
    }
  }

  async waitForIdle() {
    if (this.running === 0 && this.jobs.length === 0) return;
    await new Promise<void>((resolve) => this.idle.push(resolve));
  }

  async onModuleDestroy() {
    this.stopping = true;
    await this.waitForIdle();
    this.mail.close();
  }

  private async deliver(job: EmailJob) {
    const secret = newSecret();
    const action = await this.prisma.$transaction(async (tx) => {
      const found = await tx.user.findUnique({
        where: { email: job.email },
        select: { id: true },
      });
      if (!found) return null;
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${found.id} FOR UPDATE`;
      const user = await tx.user.findUnique({ where: { id: found.id } });
      if (
        !user ||
        (job.purpose === EmailActionPurpose.VERIFY_EMAIL &&
          user.emailVerifiedAt)
      )
        return null;
      const now = new Date();
      const recent = await tx.emailAction.findFirst({
        where: {
          userId: user.id,
          purpose: job.purpose,
          createdAt: { gt: new Date(now.getTime() - EMAIL_ACTION_COOLDOWN_MS) },
        },
      });
      if (recent) return null;
      await tx.emailAction.updateMany({
        where: { userId: user.id, purpose: job.purpose, consumedAt: null },
        data: { consumedAt: now },
      });
      return tx.emailAction.create({
        data: {
          userId: user.id,
          purpose: job.purpose,
          tokenHash: tokenHash(secret),
          expiresAt: new Date(
            now.getTime() +
              (job.purpose === EmailActionPurpose.VERIFY_EMAIL ? 30 : 15) *
                60_000,
          ),
        },
      });
    });
    if (!action) return;
    try {
      await this.mail.send(job.email, job.purpose, secret);
    } catch {
      await this.prisma.emailAction.updateMany({
        where: { id: action.id, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      throw new Error('Account email delivery failed');
    }
  }

  async verifyEmail(secret: string) {
    await this.consume(secret, EmailActionPurpose.VERIFY_EMAIL);
  }

  async resetPassword(secret: string, password: string) {
    // Validate before expensive hashing; recheck everything under the lock.
    if (!isSecret(secret)) throw new BadRequestException(EMAIL_ACTION_ERROR);
    const candidate = await this.prisma.emailAction.findUnique({
      where: { tokenHash: tokenHash(secret) },
    });
    if (
      !candidate ||
      candidate.purpose !== EmailActionPurpose.RESET_PASSWORD ||
      candidate.consumedAt ||
      candidate.expiresAt <= new Date()
    ) {
      throw new BadRequestException(EMAIL_ACTION_ERROR);
    }
    const passwordHash = await this.passwords.hash(password);
    await this.consume(secret, EmailActionPurpose.RESET_PASSWORD, passwordHash);
  }

  private async consume(
    secret: string,
    purpose: EmailActionPurpose,
    passwordHash?: string,
  ) {
    if (!isSecret(secret)) throw new BadRequestException(EMAIL_ACTION_ERROR);
    const accepted = await this.prisma.$transaction(async (tx) => {
      const found = await tx.emailAction.findUnique({
        where: { tokenHash: tokenHash(secret) },
      });
      if (!found) return false;
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${found.userId} FOR UPDATE`;
      const action = await tx.emailAction.findUnique({
        where: { id: found.id },
      });
      const now = new Date();
      if (
        !action ||
        action.purpose !== purpose ||
        action.consumedAt ||
        action.expiresAt <= now
      )
        return false;
      await tx.emailAction.update({
        where: { id: action.id },
        data: { consumedAt: now },
      });
      await tx.user.updateMany({
        where: { id: action.userId, emailVerifiedAt: null },
        data: { emailVerifiedAt: now },
      });
      if (purpose === EmailActionPurpose.RESET_PASSWORD && passwordHash) {
        await tx.passwordCredential.upsert({
          where: { userId: action.userId },
          create: { userId: action.userId, passwordHash },
          update: { passwordHash },
        });
        await tx.authSession.updateMany({
          where: { userId: action.userId, revokedAt: null },
          data: { revokedAt: now },
        });
        await tx.emailAction.updateMany({
          where: { userId: action.userId, consumedAt: null },
          data: { consumedAt: now },
        });
      }
      return true;
    });
    if (!accepted) throw new BadRequestException(EMAIL_ACTION_ERROR);
  }
}
