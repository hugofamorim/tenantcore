import { validateDemoSeedEnvironment } from './seed';

describe('demo seed environment boundary', () => {
  const environment = {
    DATABASE_URL:
      'postgresql://fixture:fixture@localhost:55433/tenantcore_demo',
    DEMO_SEED_PASSPHRASE: 'fictional seed passphrase',
    NODE_ENV: 'development',
  };
  it('accepts only explicit isolated loopback demo configuration', () => {
    expect(validateDemoSeedEnvironment(environment).passphrase).toBe(
      environment.DEMO_SEED_PASSPHRASE,
    );
  });
  it.each([
    { NODE_ENV: 'production' },
    { DATABASE_URL: 'postgresql://localhost/tenantcore' },
    { DATABASE_URL: 'postgresql://example.test/tenantcore_demo' },
    { DATABASE_URL: 'not-a-url' },
    { DEMO_SEED_PASSPHRASE: undefined },
    { DEMO_SEED_PASSPHRASE: 'short' },
  ])('rejects unsafe or incomplete seed configuration %#', (override) => {
    expect(() =>
      validateDemoSeedEnvironment({ ...environment, ...override }),
    ).toThrow();
  });
});
