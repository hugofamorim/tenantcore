import { Test } from '@nestjs/testing';
import { Logger, type INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  EmailActionsService,
  EMAIL_REQUEST_MESSAGE,
} from '../src/auth/email-actions.service';
import { MailService } from '../src/auth/mail.service';
import { EmailActionPurpose } from '../src/generated/prisma/client';
import { tokenHash, newSecret } from '../src/auth/auth.tokens';
import { capturedMail, capturedToken } from './mailpit';

describe('Email identity actions: HTTP, PostgreSQL and real SMTP', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let actions: EmailActionsService;
  let email: string;
  let verification: string;
  const password = 'the original long passphrase';
  const newPassword = 'the replacement long passphrase';
  const origin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
  const post = (path: string, body: object) =>
    request(app.getHttpServer())
      .post(`/auth/${path}`)
      .set('Origin', origin)
      .send(body);
  const resetToken = async () => {
    await post('forgot-password', { email }).expect(202);
    await actions.waitForIdle();
    return capturedToken(
      await capturedMail(email, 'Reset your TenantCore password'),
    );
  };

  beforeEach(async () => {
    email = `email-${randomUUID()}@example.test`;
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication({ bodyParser: false });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    actions = app.get(EmailActionsService);
    await post('register', { name: 'Email Test User', email, password }).expect(
      202,
    );
    await actions.waitForIdle();
    verification = capturedToken(
      await capturedMail(email, 'Verify your TenantCore email'),
    );
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    if (actions) await actions.waitForIdle();
    if (prisma) await prisma.user.deleteMany({ where: { email } });
    if (app) await app.close();
  });

  it('stores only a purpose-scoped digest and verifies exactly once', async () => {
    const stored = await prisma.emailAction.findUniqueOrThrow({
      where: { tokenHash: tokenHash(verification) },
    });
    expect(stored.tokenHash === verification).toBe(false);
    expect(stored.purpose).toBe(EmailActionPurpose.VERIFY_EMAIL);
    expect(stored.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(stored.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 30 * 60_000);
    const response = await post('verify-email', { token: verification }).expect(
      204,
    );
    expect(response.text).toBe('');
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { email } }))
        .emailVerifiedAt,
    ).not.toBeNull();
    await post('verify-email', { token: verification }).expect(400);
    expect(
      (await prisma.emailAction.findUniqueOrThrow({ where: { id: stored.id } }))
        .consumedAt,
    ).not.toBeNull();
  });

  it('does not mutate identity on GET or permit purpose confusion', async () => {
    await request(app.getHttpServer()).get('/auth/verify-email').expect(404);
    await post('reset-password', {
      token: verification,
      password: newPassword,
    }).expect(400);
    const reset = await resetToken();
    await post('verify-email', { token: reset }).expect(400);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { email } }))
        .emailVerifiedAt,
    ).toBeNull();
  });

  it('rejects random, expired and malformed action tokens without echoing them', async () => {
    const unknown = await post('verify-email', { token: newSecret() }).expect(
      400,
    );
    await prisma.emailAction.update({
      where: { tokenHash: tokenHash(verification) },
      data: { expiresAt: new Date(0) },
    });
    const expired = await post('verify-email', { token: verification }).expect(
      400,
    );
    expect(unknown.body).toEqual(expired.body);
    await post('verify-email', { token: 'invalid' }).expect(400);
    const reset = await resetToken();
    await prisma.emailAction.update({
      where: { tokenHash: tokenHash(reset) },
      data: { expiresAt: new Date(0) },
    });
    await post('reset-password', {
      token: reset,
      password: newPassword,
    }).expect(400);
    await post('login', { email, password }).expect(204);
  });

  it('uses generic request responses, normalizes emails and applies recipient cooldown', async () => {
    const known = await post('forgot-password', {
      email: ` ${email.toUpperCase()} `,
    }).expect(202);
    const unknown = await post('forgot-password', {
      email: 'missing@example.test',
    }).expect(202);
    const duplicate = await post('forgot-password', { email }).expect(202);
    expect(known.body).toEqual({ message: EMAIL_REQUEST_MESSAGE });
    expect(known.body).toEqual(unknown.body);
    expect(known.body).toEqual(duplicate.body);
    await actions.waitForIdle();
    expect(
      await prisma.emailAction.count({
        where: { user: { email }, purpose: EmailActionPurpose.RESET_PASSWORD },
      }),
    ).toBe(1);
    await post('verify-email', { token: verification }).expect(204);
    const verified = await post('resend-verification', { email }).expect(202);
    const absent = await post('resend-verification', {
      email: 'missing@example.test',
    }).expect(202);
    expect(verified.body).toEqual(absent.body);
    await actions.waitForIdle();
    expect(
      await prisma.emailAction.count({
        where: { user: { email }, purpose: EmailActionPurpose.VERIFY_EMAIL },
      }),
    ).toBe(1);
  });

  it('replaces an older verification link when an eligible resend is delivered', async () => {
    await prisma.emailAction.updateMany({
      where: { user: { email } },
      data: { createdAt: new Date(Date.now() - 61_000) },
    });
    await post('resend-verification', { email }).expect(202);
    await actions.waitForIdle();
    const replacement = capturedToken(
      await capturedMail(email, 'Verify your TenantCore email'),
    );
    expect(replacement === verification).toBe(false);
    await post('verify-email', { token: verification }).expect(400);
    await post('verify-email', { token: replacement }).expect(204);
  });

  it('atomically resets credentials, proves email ownership and revokes every session/action', async () => {
    const first = await post('login', { email, password }).expect(204);
    await post('login', { email, password }).expect(204);
    const secret = await resetToken();
    const stored = await prisma.emailAction.findUniqueOrThrow({
      where: { tokenHash: tokenHash(secret) },
    });
    expect(stored.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(stored.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 15 * 60_000);
    await post('reset-password', { token: secret, password: 'short' }).expect(
      400,
    );
    await post('reset-password', {
      token: secret,
      password: newPassword,
    }).expect(204);
    await post('login', { email, password }).expect(401);
    await post('login', { email, password: newPassword }).expect(204);
    await post('reset-password', {
      token: secret,
      password: 'another sufficiently long passphrase',
    }).expect(400);
    const cookieHeader: unknown = first.headers['set-cookie'];
    const cookies = Array.isArray(cookieHeader)
      ? cookieHeader.map((value: string) => value.split(';')[0])
      : [];
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', cookies)
      .expect(401);
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Origin', origin)
      .set('Cookie', cookies)
      .send({})
      .expect(401);
    await post('verify-email', { token: verification }).expect(400);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { email } }))
        .emailVerifiedAt,
    ).not.toBeNull();
    expect(
      await prisma.emailAction.count({
        where: { user: { email }, consumedAt: null },
      }),
    ).toBe(0);
  });

  it('allows only one concurrent verification and one concurrent reset', async () => {
    const verifies = await Promise.all([
      post('verify-email', { token: verification }),
      post('verify-email', { token: verification }),
    ]);
    expect(verifies.map((value) => value.status).sort((a, b) => a - b)).toEqual(
      [204, 400],
    );
    const secret = await resetToken();
    const resets = await Promise.all([
      post('reset-password', { token: secret, password: newPassword }),
      post('reset-password', { token: secret, password: newPassword }),
    ]);
    expect(resets.map((value) => value.status).sort((a, b) => a - b)).toEqual([
      204, 400,
    ]);
  });

  it('does not leave an old-password session usable when login races with reset', async () => {
    const secret = await resetToken();
    const [login, reset] = await Promise.all([
      post('login', { email, password }),
      post('reset-password', { token: secret, password: newPassword }),
    ]);
    expect([204, 401]).toContain(login.status);
    expect(reset.status).toBe(204);
    expect(
      await prisma.authSession.count({
        where: { user: { email }, revokedAt: null },
      }),
    ).toBe(0);
  });

  it('requires proof of email control to enroll a legacy account', async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    await prisma.passwordCredential.delete({ where: { userId: user.id } });
    await post('login', { email, password }).expect(401);
    const secret = await resetToken();
    await post('reset-password', {
      token: secret,
      password: newPassword,
    }).expect(204);
    await post('login', { email, password: newPassword }).expect(204);
  });

  it('keeps SMTP failures generic, logs no secrets and invalidates the undelivered action', async () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    jest
      .spyOn(app.get(MailService), 'send')
      .mockRejectedValueOnce(new Error('raw SMTP error containing a secret'));
    const response = await post('forgot-password', { email }).expect(202);
    expect(response.body).toEqual({ message: EMAIL_REQUEST_MESSAGE });
    await actions.waitForIdle();
    const action = await prisma.emailAction.findFirstOrThrow({
      where: { user: { email }, purpose: EmailActionPurpose.RESET_PASSWORD },
    });
    expect(action.consumedAt).not.toBeNull();
    expect(warn).toHaveBeenCalledWith(
      'Account email delivery failed; resend required',
    );
    expect(JSON.stringify(warn.mock.calls)).not.toContain('raw SMTP');
  });

  it('enforces CSRF, field validation and request rate limits for recovery', async () => {
    await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email })
      .expect(403);
    await post('forgot-password', { email, role: 'OWNER' }).expect(400);
    await post('forgot-password', { email: 'invalid' }).expect(400);
    let status = 0;
    for (let attempt = 0; attempt < 6; attempt++)
      status = (
        await post('forgot-password', { email: 'missing@example.test' })
      ).status;
    expect(status).toBe(429);
  });
});
