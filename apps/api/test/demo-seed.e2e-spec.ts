import { Client } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { PrismaClient } from '../src/generated/prisma/client';
import { seedDemo, demoUsers, demoOrganizations } from '../src/demo/seed';

describe('fictional demo seed on its own disposable database', () => {
  let admin: Client;
  let prisma: PrismaClient;
  const database = `tc_demo_${randomUUID().replaceAll('-', '')}`;
  beforeAll(async () => {
    const base = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
    if (
      !base ||
      new URL(base).pathname !== '/tenantcore_test' ||
      !/^tc_demo_[a-f0-9]{32}$/.test(database)
    )
      throw new Error('Unsafe seed test environment');
    admin = new Client({ connectionString: base });
    await admin.connect();
    await admin.query(`CREATE DATABASE "${database}"`);
    const url = new URL(base);
    url.pathname = `/${database}`;
    execFileSync(
      process.execPath,
      [
        resolve(__dirname, '../node_modules/prisma/build/index.js'),
        'migrate',
        'deploy',
      ],
      {
        cwd: resolve(__dirname, '..'),
        env: { ...process.env, DATABASE_URL: url.toString() },
        stdio: 'pipe',
        timeout: 30_000,
      },
    );
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: url.toString() }),
    });
  }, 40_000);
  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
    if (admin) {
      if (!/^tc_demo_[a-f0-9]{32}$/.test(database))
        throw new Error('Unsafe test database cleanup');
      await admin.query(`DROP DATABASE IF EXISTS "${database}"`);
      await admin.end();
    }
  });
  it('migrates and seeds repeatedly without duplicate records or overwriting changed credentials and roles', async () => {
    expect(await seedDemo(prisma, 'a fictional demo passphrase')).toEqual({
      users: 3,
      organizations: 2,
    });
    const credential = await prisma.passwordCredential.findUniqueOrThrow({
      where: { userId: demoUsers[0].id },
    });
    await prisma.user.update({
      where: { id: demoUsers[0].id },
      data: { name: 'Edited fictional name' },
    });
    await prisma.membership.delete({
      where: {
        userId_organizationId: {
          userId: demoUsers[2].id,
          organizationId: demoOrganizations[0].id,
        },
      },
    });
    await seedDemo(prisma, 'another fictional passphrase');
    expect(await prisma.user.count()).toBe(3);
    expect(await prisma.organization.count()).toBe(2);
    expect(await prisma.membership.count()).toBe(4);
    expect(await prisma.invitation.count()).toBe(1);
    expect(await prisma.auditEvent.count()).toBe(2);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: demoUsers[0].id } }))
        .name,
    ).toBe('Edited fictional name');
    expect(
      (
        await prisma.passwordCredential.findUniqueOrThrow({
          where: { userId: demoUsers[0].id },
        })
      ).passwordHash,
    ).toBe(credential.passwordHash);
  });
  it('refuses unrelated existing records rather than replacing them', async () => {
    const foreign = await prisma.user.create({
      data: { name: 'Unrelated fixture', email: 'unrelated@example.test' },
    });
    await expect(
      seedDemo(prisma, 'a fictional demo passphrase'),
    ).rejects.toThrow('refuses non-fixture');
    expect(await prisma.user.count({ where: { id: foreign.id } })).toBe(1);
  });
});
