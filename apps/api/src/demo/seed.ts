import type { PrismaClient } from '../generated/prisma/client';
import { newSecret, tokenHash } from '../auth/auth.tokens';
import { PasswordService } from '../auth/password.service';

export const demoUsers = [
  {
    id: 'a0000000-0000-4000-8000-000000000001',
    name: 'Avery Morgan',
    email: 'avery@example.test',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000002',
    name: 'Jordan Lee',
    email: 'jordan@example.test',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000003',
    name: 'Sam Rivera',
    email: 'sam@example.test',
  },
];
export const demoOrganizations = [
  {
    id: 'b0000000-0000-4000-8000-000000000001',
    name: 'Northstar Studio',
    slug: 'demo-northstar',
  },
  {
    id: 'b0000000-0000-4000-8000-000000000002',
    name: 'Harbor Collective',
    slug: 'demo-harbor',
  },
];
export function validateDemoSeedEnvironment(input: Record<string, unknown>) {
  let url: URL;
  try {
    url = new URL(
      typeof input.DATABASE_URL === 'string' ? input.DATABASE_URL : '',
    );
  } catch {
    throw new Error('Demo seed requires a valid isolated database URL');
  }
  if (
    input.NODE_ENV === 'production' ||
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    url.pathname !== '/tenantcore_demo'
  ) {
    throw new Error(
      'Demo seed requires non-production loopback tenantcore_demo',
    );
  }
  const passphrase = input.DEMO_SEED_PASSPHRASE;
  if (
    typeof passphrase !== 'string' ||
    passphrase.length < 15 ||
    passphrase.length > 128
  )
    throw new Error('Provide DEMO_SEED_PASSPHRASE with 15–128 characters');
  return { databaseUrl: url.toString(), passphrase };
}

export async function seedDemo(prisma: PrismaClient, passphrase: string) {
  if (passphrase.length < 15 || passphrase.length > 128)
    throw new Error('Invalid fictional passphrase length');
  const passwordHash = await new PasswordService().hash(passphrase);
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(774011)`;
      // Do not treat a database name alone as proof that existing rows are fictional.
      const foreignUsers = await tx.user.count({
        where: { id: { notIn: demoUsers.map((user) => user.id) } },
      });
      const foreignOrganizations = await tx.organization.count({
        where: { id: { notIn: demoOrganizations.map((org) => org.id) } },
      });
      if (foreignUsers || foreignOrganizations)
        throw new Error('Demo seed refuses non-fixture records');
      const users = await tx.user.findMany({
        select: { id: true, email: true },
      });
      if (
        users.some(
          (user) =>
            !demoUsers.some(
              (fixture) =>
                fixture.id === user.id && fixture.email === user.email,
            ),
        )
      )
        throw new Error('Demo fixture identity collision');
      const markers = await tx.auditEvent.count({
        where: {
          action: 'demo.initialized',
          id: {
            in: [
              'e0000000-0000-4000-8000-000000000001',
              'e0000000-0000-4000-8000-000000000002',
            ],
          },
        },
      });
      if (markers === 2)
        return {
          users: users.length,
          organizations: await tx.organization.count(),
        };
      if (users.length || (await tx.organization.count()))
        throw new Error(
          'Demo seed refuses partially initialized fixture records',
        );
      for (const user of demoUsers) {
        await tx.user.upsert({
          where: { id: user.id },
          update: {},
          create: {
            ...user,
            emailVerifiedAt: new Date(),
            passwordCredential: { create: { passwordHash } },
          },
        });
      }
      for (const organization of demoOrganizations) {
        await tx.organization.upsert({
          where: { id: organization.id },
          update: {},
          create: organization,
        });
      }
      const roles = [
        {
          userId: demoUsers[0].id,
          organizationId: demoOrganizations[0].id,
          role: 'OWNER' as const,
        },
        {
          userId: demoUsers[1].id,
          organizationId: demoOrganizations[0].id,
          role: 'ADMIN' as const,
        },
        {
          userId: demoUsers[2].id,
          organizationId: demoOrganizations[0].id,
          role: 'VIEWER' as const,
        },
        {
          userId: demoUsers[0].id,
          organizationId: demoOrganizations[1].id,
          role: 'VIEWER' as const,
        },
        {
          userId: demoUsers[1].id,
          organizationId: demoOrganizations[1].id,
          role: 'OWNER' as const,
        },
      ];
      for (const [index, membership] of roles.entries()) {
        // Stable IDs and create-only upserts preserve subsequent role/name changes.
        await tx.membership.upsert({
          where: {
            userId_organizationId: {
              userId: membership.userId,
              organizationId: membership.organizationId,
            },
          },
          update: {},
          create: {
            id: `c0000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
            ...membership,
          },
        });
      }
      await tx.invitation.upsert({
        where: { id: 'd0000000-0000-4000-8000-000000000001' },
        update: {},
        create: {
          id: 'd0000000-0000-4000-8000-000000000001',
          organizationId: demoOrganizations[0].id,
          email: 'future-collaborator@example.test',
          role: 'MEMBER',
          createdById: demoUsers[0].id,
          tokenHash: tokenHash(newSecret()),
          expiresAt: new Date(Date.now() + 24 * 60 * 60_000),
        },
      });
      for (const [index, org] of demoOrganizations.entries()) {
        await tx.auditEvent.upsert({
          where: {
            id: `e0000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
          },
          update: {},
          create: {
            id: `e0000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
            organizationId: org.id,
            actorId: demoUsers[index].id,
            action: 'demo.initialized',
            resource: 'organization',
            resourceId: org.id,
            metadata: { fictional: true },
          },
        });
      }
      return {
        users: demoUsers.length,
        organizations: demoOrganizations.length,
      };
    },
    { timeout: 10_000 },
  );
}
