const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (!databaseUrl || new URL(databaseUrl).pathname !== '/tenantcore_test') {
  throw new Error(
    'HTTP tests require an isolated tenantcore_test database via TEST_DATABASE_URL',
  );
}
process.env.DATABASE_URL = databaseUrl;
process.env.NODE_ENV = 'test';
process.env.WEB_ORIGIN ??= 'http://localhost:3000';
process.env.SMTP_PORT ??= '11025';
process.env.MAILPIT_URL ??= 'http://localhost:18025';
