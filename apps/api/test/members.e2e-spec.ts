import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import request, { type Response } from 'supertest';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { PasswordService } from '../src/auth/password.service';
import { MailService } from '../src/auth/mail.service';
import { tokenHash } from '../src/auth/auth.tokens';
import { OrganizationRole } from '../src/generated/prisma/client';

function cookies(response: Response): string[] {
  const header: unknown = response.headers['set-cookie'];
  return Array.isArray(header)
    ? header
        .filter((v): v is string => typeof v === 'string')
        .map((v) => v.split(';')[0])
    : [];
}

describe('M3 invitation lifecycle, membership hierarchy and atomic ownership', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let mail: MailService;
  let sent: jest.SpyInstance<Promise<void>, [string, string]>;
  let prefix: string;
  let organizationId: string;
  let foreignId: string;
  let ids: Record<string, string>;
  let memberships: Record<string, string>;
  let sessions: Record<string, string[]>;
  let passwordHash: string;
  const names = [
    'owner',
    'admin',
    'member',
    'viewer',
    'invitee',
    'outsider',
    'unverified',
  ];
  const origin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
  const password = 'a membership integration passphrase';
  const email = (name: string) => `${prefix}-${name}@example.test`;
  const mutation = (
    actor: string,
    method: 'post' | 'patch' | 'delete',
    path: string,
    body: object = {},
  ) =>
    request(app.getHttpServer())
      [method](path)
      .set('Cookie', sessions[actor] ?? '')
      .set('Origin', origin)
      .send(body);
  const path = (suffix: string, id = organizationId) =>
    `/organizations/${id}/${suffix}`;
  const read = (actor: string, suffix: string, id = organizationId) =>
    request(app.getHttpServer())
      .get(path(suffix, id))
      .set('Cookie', sessions[actor]);
  async function invite(
    actor = 'owner',
    recipient = 'invitee',
    role = 'VIEWER',
  ) {
    const response = await mutation(actor, 'post', path('invitations'), {
      email: email(recipient),
      role,
    }).expect(201);
    const call = sent.mock.calls.at(-1);
    if (!call) throw new Error('No invitation delivered');
    return {
      id: (response.body as { invitation: { id: string } }).invitation.id,
      token: call[1],
      response,
    };
  }
  const accept = (actor: string, token: string, extra: object = {}) =>
    mutation(actor, 'post', '/invitations/accept', { token, ...extra });

  beforeAll(async () => {
    passwordHash = await new PasswordService().hash(password);
  });
  beforeEach(async () => {
    prefix = `m3-${randomUUID().replaceAll('-', '').slice(0, 16)}`;
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication({ bodyParser: false });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    mail = app.get(MailService);
    sent = jest.spyOn(mail, 'sendInvitation');
    ids = {};
    memberships = {};
    sessions = {};
    for (const name of names) {
      const user = await prisma.user.create({
        data: {
          name,
          email: email(name),
          emailVerifiedAt: name === 'unverified' ? null : new Date(),
          passwordCredential: { create: { passwordHash } },
        },
      });
      ids[name] = user.id;
      sessions[name] = cookies(
        await mutation(name, 'post', '/auth/login', {
          email: user.email,
          password,
        }).expect(204),
      );
    }
    const response = await mutation('owner', 'post', '/organizations', {
      name: 'Membership workspace',
      slug: prefix,
    }).expect(201);
    organizationId = (response.body as { organization: { id: string } })
      .organization.id;
    foreignId = (
      await prisma.organization.create({
        data: { name: 'Foreign tenant', slug: `${prefix}-foreign` },
      })
    ).id;
    memberships.owner = (
      await prisma.membership.findUniqueOrThrow({
        where: { userId_organizationId: { userId: ids.owner, organizationId } },
      })
    ).id;
    for (const name of ['admin', 'member', 'viewer']) {
      const membership = await prisma.membership.create({
        data: {
          organizationId,
          userId: ids[name],
          role: name.toUpperCase() as OrganizationRole,
        },
      });
      memberships[name] = membership.id;
    }
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    if (prisma) {
      await prisma.organization.deleteMany({
        where: { slug: { startsWith: prefix } },
      });
      await prisma.auditEvent.deleteMany({
        where: { actorId: { in: Object.values(ids) } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: Object.values(ids) } },
      });
    }
    if (app) await app.close();
  });

  it('delivers a hashed, expiring invitation and accepts only its matching verified account once', async () => {
    const invitation = await invite();
    const stored = await prisma.invitation.findUniqueOrThrow({
      where: { id: invitation.id },
    });
    expect(stored.tokenHash).toBe(tokenHash(invitation.token));
    expect(stored.tokenHash).not.toBe(invitation.token);
    expect(stored.expiresAt.getTime() - Date.now()).toBeGreaterThan(
      23 * 60 * 60_000,
    );
    expect(invitation.response.body).not.toHaveProperty('invitation.tokenHash');
    expect(JSON.stringify(invitation.response.body)).not.toContain(
      invitation.token,
    );
    await accept('outsider', invitation.token).expect(400);
    await accept('invitee', invitation.token, {
      organizationId: foreignId,
    }).expect(400);
    const accepted = await accept('invitee', invitation.token).expect(200);
    expect(accepted.body).toEqual({ organizationId });
    const membership = await prisma.membership.findUniqueOrThrow({
      where: { userId_organizationId: { userId: ids.invitee, organizationId } },
    });
    expect(membership.role).toBe('VIEWER');
    await accept('invitee', invitation.token).expect(400);
    await request(app.getHttpServer())
      .get(`/organizations/${organizationId}`)
      .set('Cookie', sessions.invitee)
      .expect(200);
    await mutation('invitee', 'patch', `/organizations/${organizationId}`, {
      name: 'Forbidden',
    }).expect(403);
  });

  it('allows invitations before account creation without creating an account or elevating an existing membership', async () => {
    const invitation = await invite('owner', 'future-user', 'MEMBER');
    expect(
      await prisma.user.count({ where: { email: email('future-user') } }),
    ).toBe(0);
    await prisma.user.update({
      where: { id: ids.invitee },
      data: { email: email('future-user') },
    });
    await accept('invitee', invitation.token).expect(200);
    await mutation('owner', 'post', path('invitations'), {
      email: email('viewer'),
      role: 'ADMIN',
    }).expect(409);
    expect(
      (
        await prisma.membership.findUniqueOrThrow({
          where: { id: memberships.viewer },
        })
      ).role,
    ).toBe('VIEWER');
  });

  it('has one winner for concurrent acceptance and commits exactly one membership and acceptance event', async () => {
    const invitation = await invite();
    const results = await Promise.all([
      accept('invitee', invitation.token),
      accept('invitee', invitation.token),
    ]);
    expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([
      200, 400,
    ]);
    expect(
      await prisma.membership.count({
        where: { organizationId, userId: ids.invitee },
      }),
    ).toBe(1);
    expect(
      await prisma.auditEvent.count({
        where: {
          organizationId,
          action: 'invitation.accepted',
          resourceId: invitation.id,
        },
      }),
    ).toBe(1);
  });

  it('serializes concurrent duplicate invitations and rejects OWNER or unknown-field assignment', async () => {
    const body = { email: email('invitee'), role: 'MEMBER' };
    const results = await Promise.all([
      mutation('owner', 'post', path('invitations'), body),
      mutation('owner', 'post', path('invitations'), body),
    ]);
    expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([
      201, 409,
    ]);
    await mutation('owner', 'post', path('invitations'), {
      ...body,
      role: 'OWNER',
    }).expect(400);
    await mutation('owner', 'post', path('invitations'), {
      ...body,
      createdById: ids.admin,
    }).expect(400);
    await mutation('owner', 'post', path('invitations'), {
      ...body,
      role: null,
    }).expect(400);
  });

  it('normalizes email, rotates reissued secrets, revokes idempotently and rejects expired links', async () => {
    const response = await mutation('owner', 'post', path('invitations'), {
      email: ` ${email('invitee').toUpperCase()} `,
      role: 'MEMBER',
    }).expect(201);
    const id = (response.body as { invitation: { id: string } }).invitation.id;
    const old = sent.mock.calls.at(-1)?.[1];
    if (!old) throw new Error('Missing secret');
    await mutation('owner', 'post', path(`invitations/${id}/reissue`)).expect(
      200,
    );
    const next = sent.mock.calls.at(-1)?.[1];
    if (!next) throw new Error('Missing rotated secret');
    expect(next).not.toBe(old);
    await accept('invitee', old).expect(400);
    await prisma.invitation.update({
      where: { id },
      data: { expiresAt: new Date(0) },
    });
    await accept('invitee', next).expect(400);
    const listed = await read('owner', 'invitations').expect(200);
    expect(
      (listed.body as { items: Array<{ status: string }> }).items[0].status,
    ).toBe('EXPIRED');
    await mutation('owner', 'post', path(`invitations/${id}/reissue`)).expect(
      200,
    );
    const latest = sent.mock.calls.at(-1)?.[1];
    if (!latest) throw new Error('Missing latest secret');
    await mutation('owner', 'delete', path(`invitations/${id}`)).expect(204);
    await mutation('owner', 'delete', path(`invitations/${id}`)).expect(204);
    await accept('invitee', latest).expect(400);
    await mutation('owner', 'post', path(`invitations/${id}/reissue`)).expect(
      409,
    );
    expect(
      await prisma.auditEvent.count({
        where: { resourceId: id, action: 'invitation.revoked' },
      }),
    ).toBe(1);
  });

  it('compensates failed SMTP delivery without exposing the transport error or leaving a valid token', async () => {
    sent.mockRejectedValueOnce(new Error('private SMTP diagnostic'));
    const response = await mutation('owner', 'post', path('invitations'), {
      email: email('invitee'),
      role: 'VIEWER',
    }).expect(503);
    expect(JSON.stringify(response.body)).not.toContain('private SMTP');
    const invitation = await prisma.invitation.findFirstOrThrow({
      where: { organizationId },
    });
    expect(invitation.status).toBe('REVOKED');
    expect(
      await prisma.auditEvent.count({
        where: { organizationId, action: 'invitation.delivery_failed' },
      }),
    ).toBe(1);
  });

  it.each(['demoted', 'removed'])(
    'rechecks a %s inviter before accepting a previously issued link',
    async (change) => {
      const invitation = await invite('admin');
      if (change === 'demoted')
        await mutation('owner', 'patch', path(`members/${memberships.admin}`), {
          role: 'VIEWER',
        }).expect(200);
      else
        await mutation(
          'owner',
          'delete',
          path(`members/${memberships.admin}`),
        ).expect(204);
      await accept('invitee', invitation.token).expect(400);
      expect(
        await prisma.membership.count({
          where: { userId: ids.invitee, organizationId },
        }),
      ).toBe(0);
    },
  );

  it('enforces owner/admin hierarchy, forbids self and OWNER mutations, and applies removal immediately', async () => {
    await mutation('admin', 'post', path('invitations'), {
      email: email('invitee'),
      role: 'ADMIN',
    }).expect(403);
    await mutation('admin', 'patch', path(`members/${memberships.owner}`), {
      role: 'MEMBER',
    }).expect(403);
    await mutation('admin', 'patch', path(`members/${memberships.admin}`), {
      role: 'VIEWER',
    }).expect(403);
    await mutation('admin', 'patch', path(`members/${memberships.viewer}`), {
      role: 'ADMIN',
    }).expect(403);
    await mutation('owner', 'patch', path(`members/${memberships.owner}`), {
      role: 'ADMIN',
    }).expect(403);
    await mutation(
      'owner',
      'delete',
      path(`members/${memberships.owner}`),
    ).expect(403);
    await mutation('admin', 'patch', path(`members/${memberships.viewer}`), {
      role: 'MEMBER',
    }).expect(200);
    await mutation('owner', 'patch', path(`members/${memberships.member}`), {
      role: 'ADMIN',
    }).expect(200);
    await mutation(
      'admin',
      'delete',
      path(`members/${memberships.member}`),
    ).expect(403);
    await mutation(
      'owner',
      'delete',
      path(`members/${memberships.member}`),
    ).expect(204);
    await request(app.getHttpServer())
      .get(`/organizations/${organizationId}`)
      .set('Cookie', sessions.member)
      .expect(404);
    expect(
      await prisma.membership.count({
        where: { organizationId, role: 'OWNER' },
      }),
    ).toBe(1);
  });

  it('transfers ownership atomically and permits only one concurrent transfer by the previous owner', async () => {
    await mutation('admin', 'post', path('ownership-transfer'), {
      membershipId: memberships.member,
    }).expect(403);
    const results = await Promise.all([
      mutation('owner', 'post', path('ownership-transfer'), {
        membershipId: memberships.admin,
      }),
      mutation('owner', 'post', path('ownership-transfer'), {
        membershipId: memberships.member,
      }),
    ]);
    expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([
      200, 403,
    ]);
    const owners = await prisma.membership.findMany({
      where: { organizationId, role: 'OWNER' },
    });
    expect(owners).toHaveLength(1);
    expect(owners[0].userId).not.toBe(ids.owner);
    expect(
      (
        await prisma.membership.findUniqueOrThrow({
          where: { id: memberships.owner },
        })
      ).role,
    ).toBe('ADMIN');
    expect(
      await prisma.auditEvent.count({
        where: { organizationId, action: 'organization.ownership_transferred' },
      }),
    ).toBe(1);
    await mutation('owner', 'delete', path(`members/${owners[0].id}`)).expect(
      403,
    );
  });

  it('rejects unverified ownership targets and ambiguous legacy ownership without rewriting data', async () => {
    const unverified = await prisma.membership.create({
      data: { organizationId, userId: ids.unverified },
    });
    await mutation('owner', 'post', path('ownership-transfer'), {
      membershipId: unverified.id,
    }).expect(409);
    await prisma.membership.update({
      where: { id: memberships.admin },
      data: { role: 'OWNER' },
    });
    await mutation('owner', 'post', path('ownership-transfer'), {
      membershipId: memberships.member,
    }).expect(409);
    expect(
      await prisma.membership.count({
        where: { organizationId, role: 'OWNER' },
      }),
    ).toBe(2);
  });

  it.each(['member', 'viewer', 'outsider'])(
    'denies %s management reads/writes and prevents cross-tenant target IDs',
    async (actor) => {
      const status = actor === 'outsider' ? 404 : 403;
      for (const suffix of ['members', 'invitations', 'audit-logs'])
        await read(actor, suffix).expect(status);
      await mutation(actor, 'post', path('invitations'), {
        email: email('invitee'),
        role: 'VIEWER',
      }).expect(status);
      await mutation(actor, 'patch', path(`members/${memberships.viewer}`), {
        role: 'MEMBER',
      }).expect(status);
      await mutation(
        actor,
        'delete',
        path(`members/${memberships.viewer}`),
      ).expect(status);
      await mutation(actor, 'post', path('ownership-transfer'), {
        membershipId: memberships.viewer,
      }).expect(status);
      await read('owner', 'members', foreignId).expect(404);
      const foreign = await prisma.membership.create({
        data: {
          organizationId: foreignId,
          userId: ids.outsider,
          role: 'OWNER',
        },
      });
      await mutation('owner', 'patch', path(`members/${foreign.id}`), {
        role: 'MEMBER',
      }).expect(404);
      await mutation('owner', 'delete', path(`members/${foreign.id}`)).expect(
        404,
      );
      await mutation('owner', 'post', path('ownership-transfer'), {
        membershipId: foreign.id,
      }).expect(404);
    },
  );

  it('bounds/searches manager lists and returns only safe tenant audit fields including role changes', async () => {
    await mutation('owner', 'patch', path(`members/${memberships.viewer}`), {
      role: 'MEMBER',
    }).expect(200);
    const response = await read(
      'owner',
      'members?limit=1&search=viewer',
    ).expect(200);
    expect(response.body).toEqual({
      items: [
        expect.objectContaining({ id: memberships.viewer, role: 'MEMBER' }),
      ],
      limit: 1,
      offset: 0,
      hasMore: false,
    });
    const events = await read('admin', 'audit-logs').expect(200);
    const items = (
      events.body as { items: Array<{ action: string; metadata: object }> }
    ).items;
    expect(items).toContainEqual(
      expect.objectContaining({
        action: 'membership.role_changed',
        metadata: { from: 'VIEWER', to: 'MEMBER' },
      }),
    );
    expect(items.some((event) => event.action.startsWith('auth.'))).toBe(false);
    const serialized = JSON.stringify(events.body);
    for (const secret of [
      password,
      email('owner'),
      passwordHash,
      'tokenHash',
      'accessTokenHash',
    ])
      expect(serialized).not.toContain(secret);
    expect(events.headers['cache-control']).toBe('no-store');
    await read('owner', 'members?limit=101').expect(400);
    await read('owner', 'audit-logs?offset=-1').expect(400);
    await read('owner', 'invitations?organizationId=forged').expect(400);
    expect(
      await prisma.auditEvent.count({
        where: {
          actorId: ids.owner,
          organizationId: null,
          action: 'auth.login_succeeded',
        },
      }),
    ).toBe(1);
  });

  it('enforces pending-recipient uniqueness and non-OWNER invitations in PostgreSQL itself', async () => {
    const data = {
      organizationId,
      email: email('invitee'),
      role: OrganizationRole.VIEWER,
      createdById: ids.owner,
      tokenHash: tokenHash('a'.repeat(43)),
      expiresAt: new Date(Date.now() + 60_000),
    };
    await prisma.invitation.create({ data });
    await expect(
      prisma.invitation.create({
        data: { ...data, tokenHash: tokenHash('b'.repeat(43)) },
      }),
    ).rejects.toBeDefined();
    await expect(
      prisma.invitation.create({
        data: {
          ...data,
          email: email('outsider'),
          role: OrganizationRole.OWNER,
          tokenHash: tokenHash('c'.repeat(43)),
        },
      }),
    ).rejects.toBeDefined();
    expect(await prisma.invitation.count({ where: { organizationId } })).toBe(
      1,
    );
  });

  it('rolls back member changes if writing the audit event fails', async () => {
    // A test-only constraint targets this fixture UUID, leaving parallel suites unaffected.
    if (!/^[a-f0-9-]{36}$/.test(organizationId))
      throw new Error('Invalid fixture ID');
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "AuditEvent" ADD CONSTRAINT "m3_test_audit_failure" CHECK ("organizationId" <> '${organizationId}') NOT VALID`,
    );
    try {
      await mutation('owner', 'patch', path(`members/${memberships.viewer}`), {
        role: 'MEMBER',
      }).expect(500);
      expect(
        (
          await prisma.membership.findUniqueOrThrow({
            where: { id: memberships.viewer },
          })
        ).role,
      ).toBe('VIEWER');
      expect(
        await prisma.auditEvent.count({
          where: { organizationId, action: 'membership.role_changed' },
        }),
      ).toBe(0);
    } finally {
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "AuditEvent" DROP CONSTRAINT "m3_test_audit_failure"',
      );
    }
  });

  it('keeps one owner when target removal races ownership transfer', async () => {
    const results = await Promise.all([
      mutation('owner', 'post', path('ownership-transfer'), {
        membershipId: memberships.member,
      }),
      mutation('owner', 'delete', path(`members/${memberships.member}`)),
    ]);
    const statuses = results.map((r) => r.status);
    expect(
      statuses[0] === 200
        ? statuses[1] === 403
        : statuses[0] === 404 && statuses[1] === 204,
    ).toBe(true);
    expect(
      await prisma.membership.count({
        where: { organizationId, role: 'OWNER' },
      }),
    ).toBe(1);
  });

  it('keeps reissued and revoked invitations scoped to the organization and manager hierarchy', async () => {
    const invitation = await invite('owner', 'invitee', 'ADMIN');
    await mutation(
      'admin',
      'post',
      path(`invitations/${invitation.id}/reissue`),
    ).expect(403);
    await mutation(
      'admin',
      'delete',
      path(`invitations/${invitation.id}`),
    ).expect(403);
    await mutation(
      'owner',
      'post',
      path(`invitations/${invitation.id}/reissue`, foreignId),
    ).expect(404);
    await mutation(
      'owner',
      'delete',
      path(`invitations/${invitation.id}`, foreignId),
    ).expect(404);
    await mutation(
      'viewer',
      'delete',
      path(`invitations/${invitation.id}`),
    ).expect(403);
    expect(
      (
        await prisma.invitation.findUniqueOrThrow({
          where: { id: invitation.id },
        })
      ).status,
    ).toBe('PENDING');
  });

  it('keeps acceptance throttling enabled for repeated invalid secrets', async () => {
    for (let index = 0; index < 10; index++)
      await accept('invitee', 'a'.repeat(43)).expect(400);
    await accept('invitee', 'a'.repeat(43)).expect(429);
  });

  it('requires verified identity and preserves CSRF validation on acceptance and destructive operations', async () => {
    const invitation = await invite('owner', 'unverified');
    await accept('unverified', invitation.token).expect(403);
    await request(app.getHttpServer())
      .post('/invitations/accept')
      .set('Origin', origin)
      .send({ token: invitation.token })
      .expect(401);
    await request(app.getHttpServer())
      .delete(path(`members/${memberships.member}`))
      .set('Cookie', sessions.owner)
      .send({})
      .expect(403);
    await request(app.getHttpServer())
      .post('/invitations/accept')
      .set('Cookie', sessions.invitee)
      .set('Origin', 'https://attacker.test')
      .send({ token: invitation.token })
      .expect(403);
    expect(
      await prisma.auditEvent.count({
        where: { organizationId, action: 'membership.removed' },
      }),
    ).toBe(0);
  });
});
