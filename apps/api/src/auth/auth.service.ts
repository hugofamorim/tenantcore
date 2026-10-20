import {
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EmailActionPurpose, Prisma } from '../generated/prisma/client';
import { PasswordService } from './password.service';
import { LoginDto, RegisterDto } from './auth.dto';
import { EmailActionsService } from './email-actions.service';
import { isSecret as validToken, newSecret, tokenHash } from './auth.tokens';
export { tokenHash } from './auth.tokens';

export const ACCESS_LIFETIME_MS = 15 * 60 * 1000;
export const REFRESH_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
export const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  emailVerifiedAt: true,
} as const;
export type PublicUser = Prisma.UserGetPayload<{
  select: typeof publicUserSelect;
}>;

function newTokens() {
  return {
    access: newSecret(),
    refresh: newSecret(),
  };
}

@Injectable()
export class AuthService implements OnModuleInit {
  private dummyHash!: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly emailActions: EmailActionsService,
  ) {}

  async onModuleInit() {
    this.dummyHash = await this.passwords.hash(randomBytes(32).toString('hex'));
  }

  async register(input: RegisterDto) {
    // Hash even for duplicates; never replace an existing user's credentials.
    const passwordHash = await this.passwords.hash(input.password);
    try {
      await this.prisma.user.create({
        data: {
          name: input.name,
          email: input.email,
          passwordCredential: { create: { passwordHash } },
        },
        select: { id: true },
      });
    } catch (error) {
      if (!(
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ))
        throw error;
    }
    this.emailActions.request(input.email, EmailActionPurpose.VERIFY_EMAIL);
    return {
      message:
        'If this email is available, your account has been created. You can now sign in.',
    };
  }

  async login(input: LoginDto) {
    const found = await this.prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });
    if (!found) {
      await this.passwords.verify(this.dummyHash, input.password);
      throw new UnauthorizedException('Invalid email or password');
    }
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${found.id} FOR UPDATE`;
      const credential = await tx.passwordCredential.findUnique({
        where: { userId: found.id },
      });
      const matches = await this.passwords.verify(
        credential?.passwordHash ?? this.dummyHash,
        input.password,
      );
      if (!matches || !credential) return null;
      const tokens = newTokens();
      const expiresAt = new Date(Date.now() + REFRESH_LIFETIME_MS);
      await tx.authSession.create({
        data: {
          userId: found.id,
          familyId: randomUUID(),
          accessTokenHash: tokenHash(tokens.access),
          refreshTokenHash: tokenHash(tokens.refresh),
          accessExpiresAt: new Date(Date.now() + ACCESS_LIFETIME_MS),
          expiresAt,
        },
      });
      return { tokens, expiresAt };
    });
    if (!result) throw new UnauthorizedException('Invalid email or password');
    return result;
  }

  async me(token: string | undefined): Promise<PublicUser> {
    if (!validToken(token))
      throw new UnauthorizedException('Authentication required');
    const session = await this.prisma.authSession.findUnique({
      where: { accessTokenHash: tokenHash(token) },
      include: { user: { select: publicUserSelect } },
    });
    if (
      !session ||
      session.revokedAt ||
      session.accessExpiresAt <= new Date() ||
      session.expiresAt <= new Date()
    ) {
      throw new UnauthorizedException('Authentication required');
    }
    return session.user;
  }

  async refresh(token: string | undefined) {
    if (!validToken(token)) throw new UnauthorizedException('Session expired');
    const tokens = newTokens();
    const result = await this.prisma.$transaction(async (tx) => {
      const found = await tx.authSession.findUnique({
        where: { refreshTokenHash: tokenHash(token) },
      });
      if (!found) return null;
      // Serialize rotation/logout for this user, including newly inserted successors.
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${found.userId} FOR UPDATE`;
      const session = await tx.authSession.findUnique({
        where: { id: found.id },
      });
      if (!session) return null;
      const now = new Date();
      if (session.revokedAt || session.expiresAt <= now) {
        await tx.authSession.updateMany({
          where: { familyId: session.familyId, revokedAt: null },
          data: { revokedAt: now },
        });
        return null;
      }
      const claimed = await tx.authSession.updateMany({
        where: { id: session.id, revokedAt: null },
        data: { revokedAt: now },
      });
      if (claimed.count !== 1) {
        await tx.authSession.updateMany({
          where: { familyId: session.familyId, revokedAt: null },
          data: { revokedAt: now },
        });
        return null;
      }
      await tx.authSession.create({
        data: {
          userId: session.userId,
          familyId: session.familyId,
          accessTokenHash: tokenHash(tokens.access),
          refreshTokenHash: tokenHash(tokens.refresh),
          accessExpiresAt: new Date(
            Math.min(
              now.getTime() + ACCESS_LIFETIME_MS,
              session.expiresAt.getTime(),
            ),
          ),
          expiresAt: session.expiresAt,
        },
      });
      return { tokens, expiresAt: session.expiresAt };
    });
    // Throw outside the transaction so replay revocation is committed.
    if (!result) throw new UnauthorizedException('Session expired');
    return result;
  }

  async logout(access: string | undefined, refresh: string | undefined) {
    const hashes = [access, refresh].filter(validToken).map(tokenHash);
    if (hashes.length === 0) return;
    // Also accept a rotated/expired token to revoke its whole family.
    await this.prisma.$transaction(async (tx) => {
      const sessions = await tx.authSession.findMany({
        where: {
          OR: [
            { accessTokenHash: { in: hashes } },
            { refreshTokenHash: { in: hashes } },
          ],
        },
        select: { familyId: true, userId: true },
      });
      for (const userId of [...new Set(sessions.map((s) => s.userId))].sort(
        (a, b) => a.localeCompare(b),
      )) {
        await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
      }
      await tx.authSession.updateMany({
        where: {
          familyId: { in: sessions.map((s) => s.familyId) },
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
    });
  }
}
