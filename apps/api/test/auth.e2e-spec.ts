import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request, { type Response } from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { tokenHash } from '../src/auth/auth.service';

function cookieHeaders(response: Response): string[] {
  const header: unknown = response.headers['set-cookie'];
  if (Array.isArray(header))
    return header.filter((value): value is string => typeof value === 'string');
  return typeof header === 'string' ? [header] : [];
}

function cookies(response: Response): string[] {
  return cookieHeaders(response).map((value) => value.split(';')[0]);
}

function token(values: string[], name: string) {
  const value = values.find((cookie) => cookie.startsWith(`${name}=`));
  if (!value) throw new Error('Expected authentication cookie');
  return value.slice(name.length + 1);
}

describe('Authentication HTTP + PostgreSQL', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const prefix = `m1-${randomUUID()}`;
  const email = `${prefix}@example.test`;
  const password = 'a sufficiently long passphrase ';
  const origin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
  const credentials = { email, password };
  const login = () =>
    request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', origin)
      .send(credentials)
      .expect(204);
  const post = (path: string, session: string[]) =>
    request(app.getHttpServer())
      .post(path)
      .set('Origin', origin)
      .set('Cookie', session)
      .send({});

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication({ bodyParser: false });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (prisma)
      await prisma.user.deleteMany({
        where: { email: { startsWith: prefix } },
      });
    if (app) await app.close();
  });

  it('registers atomically, normalizes email and stores only a password hash', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .set('Origin', origin)
      .send({
        name: ' Test User ',
        email: ` ${email.toUpperCase()} `,
        password,
      })
      .expect(202);
    expect(cookies(response)).toEqual([]);
    expect(response.body).toEqual({ message: expect.any(String) });
    const user = await prisma.user.findUniqueOrThrow({
      where: { email },
      include: { passwordCredential: true },
    });
    expect(user.name).toBe('Test User');
    expect(user.emailVerifiedAt).toBeNull();
    expect(user.passwordCredential?.passwordHash).toContain('$argon2id$');
    expect(user.passwordCredential?.passwordHash).not.toContain(password);
  });

  it('does not enumerate duplicates or overwrite their credentials', async () => {
    const before = await prisma.passwordCredential.findFirstOrThrow({
      where: { user: { email } },
    });
    const [first, second] = await Promise.all(
      [1, 2].map(() =>
        request(app.getHttpServer())
          .post('/auth/register')
          .set('Origin', origin)
          .send({
            name: 'Replacement',
            email,
            password: 'a different long passphrase',
          })
          .expect(202),
      ),
    );
    expect(first.body).toEqual(second.body);
    const after = await prisma.passwordCredential.findUniqueOrThrow({
      where: { userId: before.userId },
    });
    expect(after.passwordHash).toBe(before.passwordHash);
  });

  it('requires authentication and rejects malformed cookies', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', 'tc_access=invalid')
      .expect(401);
    await post('/auth/refresh', []).expect(401);
  });

  it('validates DTOs and prevents extra privilege fields', async () => {
    for (const body of [
      { name: 'X', email, password },
      { name: 'User', email: 'invalid', password },
      { name: 'User', email, password: 'short' },
      { name: 'User', email, password, role: 'OWNER' },
      { name: 'User', email, password: 'x'.repeat(129) },
      { name: 123, email, password },
    ])
      await request(app.getHttpServer())
        .post('/auth/register')
        .set('Origin', origin)
        .send(body)
        .expect(400);
  });

  it('rejects missing and foreign origins and non-JSON mutations', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send(credentials)
      .expect(403);
    for (const foreign of [
      'null',
      'https://attacker.test',
      `${origin}.attacker.test`,
    ]) {
      await request(app.getHttpServer())
        .post('/auth/login')
        .set('Origin', foreign)
        .send(credentials)
        .expect(403);
    }
    await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', origin)
      .type('form')
      .send(credentials)
      .expect(415);
    await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', origin)
      .send({ ...credentials, password: 'x'.repeat(17000) })
      .expect(413);
  });

  it('uses generic failures for unknown users and incorrect credentials', async () => {
    const invalid = await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', origin)
      .send({ ...credentials, password: 'an incorrect long password' })
      .expect(401);
    const missing = await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', origin)
      .send({ ...credentials, email: `${prefix}-missing@example.test` })
      .expect(401);
    expect(invalid.body).toEqual(missing.body);
    await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', origin)
      .send({ ...credentials, password: password.trim() })
      .expect(401);
  });

  it('sets protected cookies, never returns secrets and identifies the user', async () => {
    const response = await login();
    const session = cookies(response);
    expect(response.text).toBe('');
    const headers = cookieHeaders(response);
    for (const header of headers) {
      expect(header).toContain('HttpOnly');
      expect(header).toContain('SameSite=Lax');
      expect(header).toContain('Path=/');
      expect(header).not.toContain('Domain=');
    }
    const stored = await prisma.authSession.findUniqueOrThrow({
      where: { accessTokenHash: tokenHash(token(session, 'tc_access')) },
    });
    expect(stored.refreshTokenHash).toBe(
      tokenHash(token(session, 'tc_refresh')),
    );
    expect(stored.accessTokenHash).not.toBe(token(session, 'tc_access'));
    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', session)
      .expect(200);
    expect(me.headers['cache-control']).toBe('no-store');
    expect(me.body).toEqual({
      user: {
        id: expect.any(String),
        name: 'Test User',
        email,
        emailVerifiedAt: null,
      },
    });
  });

  it('rotates both tokens and revokes the entire family on replay', async () => {
    const initial = cookies(await login());
    const renewed = cookies(await post('/auth/refresh', initial).expect(204));
    expect(token(renewed, 'tc_access')).not.toBe(token(initial, 'tc_access'));
    expect(token(renewed, 'tc_refresh')).not.toBe(token(initial, 'tc_refresh'));
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', initial)
      .expect(401);
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', renewed)
      .expect(200);
    await post('/auth/refresh', initial).expect(401);
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', renewed)
      .expect(401);
    await post('/auth/refresh', renewed).expect(401);
  });

  it('handles concurrent refresh as replay without leaving an active family', async () => {
    const initial = cookies(await login());
    const results = await Promise.all([
      post('/auth/refresh', initial),
      post('/auth/refresh', initial),
    ]);
    expect(
      results.map((result) => result.status).sort((a, b) => a - b),
    ).toEqual([204, 401]);
    const original = await prisma.authSession.findUniqueOrThrow({
      where: { refreshTokenHash: tokenHash(token(initial, 'tc_refresh')) },
    });
    expect(
      await prisma.authSession.count({
        where: { familyId: original.familyId, revokedAt: null },
      }),
    ).toBe(0);
  });

  it('rejects expired access, renews it, and preserves the absolute expiry', async () => {
    const initial = cookies(await login());
    const original = await prisma.authSession.update({
      where: { accessTokenHash: tokenHash(token(initial, 'tc_access')) },
      data: { accessExpiresAt: new Date(0) },
    });
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', initial)
      .expect(401);
    const renewed = cookies(await post('/auth/refresh', initial).expect(204));
    const current = await prisma.authSession.findUniqueOrThrow({
      where: { refreshTokenHash: tokenHash(token(renewed, 'tc_refresh')) },
    });
    expect(current.expiresAt).toEqual(original.expiresAt);
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', renewed)
      .expect(200);
    await prisma.authSession.update({
      where: { id: current.id },
      data: { expiresAt: new Date(0) },
    });
    await post('/auth/refresh', renewed).expect(401);
  });

  it('logs out idempotently and rejects saved tokens afterwards', async () => {
    const session = cookies(await login());
    const response = await post('/auth/logout', session).expect(204);
    for (const value of cookies(response))
      expect(value.endsWith('=')).toBe(true);
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', session)
      .expect(401);
    await post('/auth/refresh', session).expect(401);
    await post('/auth/logout', session).expect(204);
  });

  it('keeps independent login families usable after another family logs out', async () => {
    const first = cookies(await login());
    const second = cookies(await login());
    await post('/auth/logout', first).expect(204);
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', second)
      .expect(200);
  });

  it('does not let a refresh racing with logout resurrect a session', async () => {
    const initial = cookies(await login());
    const original = await prisma.authSession.findUniqueOrThrow({
      where: { refreshTokenHash: tokenHash(token(initial, 'tc_refresh')) },
    });
    const [refresh, logout] = await Promise.all([
      post('/auth/refresh', initial),
      post('/auth/logout', initial),
    ]);
    expect([204, 401]).toContain(refresh.status);
    expect(logout.status).toBe(204);
    expect(
      await prisma.authSession.count({
        where: { familyId: original.familyId, revokedAt: null },
      }),
    ).toBe(0);
  });

  it('never enrolls a legacy user by overwriting an existing account', async () => {
    const legacyEmail = `${prefix}-legacy@example.test`;
    const legacy = await prisma.user.create({
      data: { name: 'Legacy User', email: legacyEmail },
    });
    await request(app.getHttpServer())
      .post('/auth/register')
      .set('Origin', origin)
      .send({ name: 'Replacement', email: legacyEmail, password })
      .expect(202);
    expect(
      await prisma.passwordCredential.findUnique({
        where: { userId: legacy.id },
      }),
    ).toBeNull();
    await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', origin)
      .send({ email: legacyEmail, password })
      .expect(401);
  });

  it('rate limits repeated login attempts without trusting forwarded IPs', async () => {
    let status = 0;
    for (let attempt = 0; attempt < 21; attempt++) {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .set('Origin', origin)
        .set('X-Forwarded-For', `192.0.2.${attempt + 1}`)
        .send({});
      status = response.status;
      if (status === 429) break;
    }
    expect(status).toBe(429);
  });
});
