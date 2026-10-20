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
        SMTP_HOST: 'smtp.example.com',
        SMTP_FROM: 'noreply@example.com',
      }).PORT,
    ).toBe(3001);
  });

  it('requires explicit encrypted production SMTP and rejects malformed settings', () => {
    const production = {
      ...database,
      NODE_ENV: 'production',
      WEB_ORIGIN: 'https://example.com',
    };
    expect(() => validateEnvironment(production)).toThrow('SMTP_HOST');
    expect(() =>
      validateEnvironment({
        ...production,
        SMTP_HOST: 'smtp.example.com',
        SMTP_FROM: 'noreply@example.com',
        SMTP_REQUIRE_TLS: 'false',
      }),
    ).toThrow('requires TLS');
    expect(() =>
      validateEnvironment({ ...database, SMTP_SECURE: 'yes' }),
    ).toThrow('true or false');
    expect(() => validateEnvironment({ ...database, SMTP_PORT: 0 })).toThrow(
      'SMTP_PORT',
    );
    expect(() =>
      validateEnvironment({ ...database, SMTP_USER: 'user' }),
    ).toThrow('configured together');
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

  it('binds to loopback by default and requires an explicit supported network address', () => {
    expect(validateEnvironment(database).API_HOST).toBe('127.0.0.1');
    expect(
      validateEnvironment({ ...database, API_HOST: '0.0.0.0' }).API_HOST,
    ).toBe('0.0.0.0');
    expect(() =>
      validateEnvironment({ ...database, API_HOST: 'untrusted.example.test' }),
    ).toThrow('API_HOST');
  });
});
