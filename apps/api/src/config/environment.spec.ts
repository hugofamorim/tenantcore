import { validateEnvironment } from './environment';

describe('environment validation', () => {
  const database = { DATABASE_URL: 'postgresql://localhost/tenantcore_test' };

  it('provides development defaults without weakening production', () => {
    expect(validateEnvironment(database).WEB_ORIGIN).toBe(
      'http://localhost:3000',
    );
    expect(() =>
      validateEnvironment({ ...database, NODE_ENV: 'production' }),
    ).toThrow('WEB_ORIGIN');
    expect(() =>
      validateEnvironment({
        ...database,
        NODE_ENV: 'production',
        WEB_ORIGIN: 'http://example.com',
      }),
    ).toThrow('HTTPS');
    expect(
      validateEnvironment({
        ...database,
        NODE_ENV: 'production',
        WEB_ORIGIN: 'https://example.com',
      }).PORT,
    ).toBe(3001);
  });

  it('rejects invalid URLs, origins and ports', () => {
    expect(() => validateEnvironment({})).toThrow('DATABASE_URL');
    expect(() => validateEnvironment({ ...database, PORT: 0 })).toThrow('PORT');
    expect(() =>
      validateEnvironment({
        ...database,
        WEB_ORIGIN: 'http://localhost:3000/path',
      }),
    ).toThrow('exact origin');
  });
});
