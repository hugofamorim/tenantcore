import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import request, { type Response } from 'supertest';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { PasswordService } from '../src/auth/password.service';
import { OrganizationsService } from '../src/organizations/organizations.service';
import { OrganizationRole } from '../src/generated/prisma/client';

function cookies(response: Response): string[] {
  const header: unknown = response.headers['set-cookie'];
  return Array.isArray(header)
    ? header
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.split(';')[0])
    : [];
}

describe('Organizations: tenant and role isolation over HTTP/PostgreSQL', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let passwordHash: string;
  let prefix: string;
  let ids: Record<string, string>;
  let sessions: Record<string, string[]>;
  let firstId: string;
  let secondId: string;
  const origin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
  const password = 'a verified organization passphrase';
  const names = [
    'ownerA',
    'ownerB',
    'admin',
    'member',
    'viewer',
    'outsider',
    'unverified',
  ];
  const read = (actor: string, path = '') =>
    request(app.getHttpServer())
      .get(`/organizations${path}`)
      .set('Cookie', sessions[actor]);
  const create = (actor: string, data: object) =>
    request(app.getHttpServer())
      .post('/organizations')
      .set('Origin', origin)
      .set('Cookie', sessions[actor])
      .send(data);
  const patch = (actor: string, id: string, data: object) =>
    request(app.getHttpServer())
      .patch(`/organizations/${id}`)
      .set('Origin', origin)
      .set('Cookie', sessions[actor])
      .send(data);

  beforeAll(async () => {
    passwordHash = await new PasswordService().hash(password);
  });

  beforeEach(async () => {
    prefix = `m2-${randomUUID().replaceAll('-', '').slice(0, 20)}`;
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication({ bodyParser: false });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    ids = {};
    sessions = {};
    for (const name of names) {
      const email = `${prefix}-${name.toLowerCase()}@example.test`;
      const user = await prisma.user.create({
        data: {
          name,
          email,
          emailVerifiedAt: name === 'unverified' ? null : new Date(),
          passwordCredential: { create: { passwordHash } },
        },
      });
      ids[name] = user.id;
      sessions[name] = cookies(
        await request(app.getHttpServer())
          .post('/auth/login')
          .set('Origin', origin)
          .send({ email, password })
          .expect(204),
      );
    }
    const first = await create('ownerA', {
      name: 'First organization',
      slug: `${prefix}-first`,
    }).expect(201);
    const second = await create('ownerB', {
      name: 'Second organization',
      slug: `${prefix}-second`,
    }).expect(201);
    firstId = (first.body as { organization: { id: string } }).organization.id;
    secondId = (second.body as { organization: { id: string } }).organization
      .id;
    await prisma.membership.createMany({
      data: [
        {
          userId: ids.admin,
          organizationId: firstId,
          role: OrganizationRole.ADMIN,
        },
        {
          userId: ids.member,
          organizationId: firstId,
          role: OrganizationRole.MEMBER,
        },
        {
          userId: ids.member,
          organizationId: secondId,
          role: OrganizationRole.VIEWER,
        },
        {
          userId: ids.viewer,
          organizationId: firstId,
          role: OrganizationRole.VIEWER,
        },
        {
          userId: ids.unverified,
          organizationId: firstId,
          role: OrganizationRole.ADMIN,
        },
      ],
    });
  });

  afterEach(async () => {
    if (prisma) {
      await prisma.organization.deleteMany({
        where: { slug: { startsWith: prefix } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: Object.values(ids) } },
      });
    }
    if (app) await app.close();
  });

  it('creates exactly one owner atomically and normalizes the chosen slug', async () => {
    const response = await create('ownerA', {
      name: ' New workspace ',
      slug: ` ${prefix.toUpperCase()}-NEW `,
    }).expect(201);
    const organization = (
      response.body as {
        organization: { id: string; name: string; slug: string; role: string };
      }
    ).organization;
    expect(organization.name).toBe('New workspace');
    expect(organization.slug).toBe(`${prefix}-new`);
    expect(organization.role).toBe('OWNER');
    const memberships = await prisma.membership.findMany({
      where: { organizationId: organization.id },
    });
    expect(memberships).toHaveLength(1);
    expect(memberships[0].userId).toBe(ids.ownerA);
    expect(memberships[0].role).toBe('OWNER');
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('rolls back organization creation if its owner membership cannot be persisted', async () => {
    const slug = `${prefix}-rollback`;
    await expect(
      app
        .get(OrganizationsService)
        .create(randomUUID(), { name: 'Rollback', slug }),
    ).rejects.toBeDefined();
    expect(await prisma.organization.count({ where: { slug } })).toBe(0);
  });

  it('returns one winner for concurrent slug collisions without orphan organizations', async () => {
    const slug = `${prefix}-collision`;
    const responses = await Promise.all([
      create('ownerA', { name: 'Collision A', slug }),
      create('ownerB', { name: 'Collision B', slug }),
    ]);
    expect(
      responses.map((response) => response.status).sort((a, b) => a - b),
    ).toEqual([201, 409]);
    const organization = await prisma.organization.findUniqueOrThrow({
      where: { slug },
      include: { memberships: true },
    });
    expect(organization.memberships).toHaveLength(1);
    expect(organization.memberships[0].role).toBe('OWNER');
  });

  it('lists only memberships of the caller with organization-relative roles', async () => {
    const owner = await read('ownerA').expect(200);
    expect(owner.body).toEqual({
      items: [expect.objectContaining({ id: firstId, role: 'OWNER' })],
      limit: 20,
      offset: 0,
      hasMore: false,
    });
    const member = await read('member').expect(200);
    expect(
      (member.body as { items: Array<{ id: string; role: string }> }).items,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: firstId, role: 'MEMBER' }),
        expect.objectContaining({ id: secondId, role: 'VIEWER' }),
      ]),
    );
    expect((await read('outsider').expect(200)).body).toEqual({
      items: [],
      limit: 20,
      offset: 0,
      hasMore: false,
    });
    expect(owner.headers['cache-control']).toBe('no-store');
  });

  it('paginates membership scope without global counts or repeated rows', async () => {
    const first = await read('member', '?limit=1').expect(200);
    const second = await read('member', '?limit=1&offset=1').expect(200);
    const a = first.body as { items: Array<{ id: string }>; hasMore: boolean };
    const b = second.body as { items: Array<{ id: string }>; hasMore: boolean };
    expect(a.items).toHaveLength(1);
    expect(a.hasMore).toBe(true);
    expect(b.hasMore).toBe(false);
    expect(a.items[0].id).not.toBe(b.items[0].id);
    expect(first.body).not.toHaveProperty('total');
    await read('member', '?limit=101').expect(400);
    await read('member', '?offset=-1').expect(400);
    await read('member', '?userId=forged').expect(400);
  });

  it.each(['ownerA', 'admin', 'member', 'viewer'])(
    'allows %s to read only the public organization projection',
    async (actor) => {
      const response = await read(actor, `/${firstId}`).expect(200);
      expect(response.body).toEqual({
        organization: {
          id: firstId,
          name: 'First organization',
          slug: `${prefix}-first`,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
          role: actor === 'ownerA' ? 'OWNER' : actor.toUpperCase(),
        },
      });
    },
  );

  it('hides foreign and nonexistent tenants behind the same 404 and ignores forged context headers', async () => {
    const foreign = await read('ownerA', `/${secondId}`)
      .set('X-Organization-Id', firstId)
      .expect(404);
    const missing = await read('ownerA', `/${randomUUID()}`).expect(404);
    expect(foreign.body).toEqual(missing.body);
    await patch('ownerA', secondId, { name: 'Cross-tenant overwrite' })
      .set('X-Organization-Id', firstId)
      .expect(404);
    expect(
      (await prisma.organization.findUniqueOrThrow({ where: { id: secondId } }))
        .name,
    ).toBe('Second organization');
  });

  it.each(['ownerA', 'admin'])(
    'allows %s settings edits without changing memberships or tenant IDs',
    async (actor) => {
      const response = await patch(actor, firstId, {
        name: 'Updated workspace',
        slug: `${prefix}-updated`,
      }).expect(200);
      expect(response.body).toEqual({
        organization: expect.objectContaining({
          id: firstId,
          name: 'Updated workspace',
          slug: `${prefix}-updated`,
        }),
      });
      expect(
        await prisma.membership.count({
          where: { organizationId: firstId, role: OrganizationRole.OWNER },
        }),
      ).toBe(1);
      await read(actor, `/${firstId}`).expect(200);
    },
  );

  it.each(['member', 'viewer'])(
    'denies %s settings writes and preserves stored data',
    async (actor) => {
      await patch(actor, firstId, { name: 'Forbidden overwrite' }).expect(403);
      expect(
        (
          await prisma.organization.findUniqueOrThrow({
            where: { id: firstId },
          })
        ).name,
      ).toBe('First organization');
    },
  );

  it('rechecks membership and role on every operation after access changes', async () => {
    await read('admin', `/${firstId}`).expect(200);
    await prisma.membership.update({
      where: {
        userId_organizationId: { userId: ids.admin, organizationId: firstId },
      },
      data: { role: OrganizationRole.VIEWER },
    });
    await patch('admin', firstId, { name: 'Stale ADMIN claim' }).expect(403);
    await prisma.membership.delete({
      where: {
        userId_organizationId: { userId: ids.admin, organizationId: firstId },
      },
    });
    await read('admin', `/${firstId}`).expect(404);
    await patch('admin', firstId, { name: 'Removed membership' }).expect(404);
    expect((await read('admin').expect(200)).body).toEqual({
      items: [],
      limit: 20,
      offset: 0,
      hasMore: false,
    });
  });

  it('requires authentication and verified email for every organization operation', async () => {
    await request(app.getHttpServer()).get('/organizations').expect(401);
    await request(app.getHttpServer())
      .post('/organizations')
      .set('Origin', origin)
      .send({ name: 'Anonymous', slug: `${prefix}-anon` })
      .expect(401);
    await read('unverified').expect(403);
    await read('unverified', `/${firstId}`).expect(403);
    await create('unverified', {
      name: 'Unverified',
      slug: `${prefix}-unverified`,
    }).expect(403);
    await patch('unverified', firstId, { name: 'Unverified overwrite' }).expect(
      403,
    );
  });

  it('rejects invalid slugs, reserved names and mass assignment', async () => {
    for (const slug of [
      'admin',
      '-bad',
      'bad--slug',
      'bad/slug',
      'ab',
      'x'.repeat(49),
    ]) {
      await create('ownerA', { name: 'Invalid slug', slug }).expect(400);
    }
    await create('ownerA', {
      name: 'Mass assignment',
      slug: `${prefix}-mass`,
      role: 'OWNER',
      userId: ids.ownerB,
    }).expect(400);
    await patch('ownerA', firstId, { name: null }).expect(400);
    await patch('ownerA', firstId, {}).expect(400);
    await patch('ownerA', firstId, {
      organizationId: secondId,
      role: 'OWNER',
    }).expect(400);
    await patch('ownerA', firstId, { slug: `${prefix}-second` }).expect(409);
    await read('ownerA', '/not-a-uuid').expect(400);
  });

  it('keeps CSRF and JSON validation active on organization mutations', async () => {
    await request(app.getHttpServer())
      .post('/organizations')
      .set('Cookie', sessions.ownerA)
      .send({ name: 'No Origin', slug: `${prefix}-csrf` })
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/organizations/${firstId}`)
      .set('Cookie', sessions.ownerA)
      .set('Origin', 'https://attacker.test')
      .send({ name: 'Cross-site' })
      .expect(403);
    await request(app.getHttpServer())
      .post('/organizations')
      .set('Cookie', sessions.ownerA)
      .set('Origin', origin)
      .type('form')
      .send({ name: 'Form body', slug: `${prefix}-form` })
      .expect(415);
  });
});
