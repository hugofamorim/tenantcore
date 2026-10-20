import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { seedDemo, validateDemoSeedEnvironment } from './seed';

async function main() {
  const { databaseUrl, passphrase } = validateDemoSeedEnvironment(process.env);
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
  try {
    const result = await seedDemo(prisma, passphrase);
    console.log(JSON.stringify({ event: 'demo_seed_completed', ...result }));
  } finally {
    await prisma.$disconnect();
  }
}
void main().catch(() => {
  console.error(
    'Demo seed failed. Check the isolated database, migrations, non-production mode and fictional passphrase; existing data was not replaced.',
  );
  process.exitCode = 1;
});
