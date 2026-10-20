export function validateEnvironment(input: Record<string, unknown>) {
  const nodeEnv =
    typeof input.NODE_ENV === 'string' ? input.NODE_ENV : 'development';
  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    throw new Error('NODE_ENV must be development, test or production');
  }
  const databaseUrl =
    typeof input.DATABASE_URL === 'string' ? input.DATABASE_URL : '';
  if (!/^postgres(?:ql)?:\/\//.test(databaseUrl)) {
    throw new Error('DATABASE_URL must be a PostgreSQL connection URL');
  }
  const webOrigin =
    typeof input.WEB_ORIGIN === 'string'
      ? input.WEB_ORIGIN
      : nodeEnv === 'production'
        ? ''
        : 'http://localhost:3000';
  let origin: URL;
  try {
    origin = new URL(webOrigin);
  } catch {
    throw new Error('WEB_ORIGIN must be an absolute origin');
  }
  if (
    origin.origin !== webOrigin ||
    !['http:', 'https:'].includes(origin.protocol) ||
    (nodeEnv === 'production' && origin.protocol !== 'https:')
  ) {
    throw new Error('WEB_ORIGIN must be an exact origin (HTTPS in production)');
  }
  const port = Number(input.PORT ?? 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  const production = nodeEnv === 'production';
  const smtpHost =
    typeof input.SMTP_HOST === 'string'
      ? input.SMTP_HOST.trim()
      : production
        ? ''
        : 'localhost';
  const smtpFrom =
    typeof input.SMTP_FROM === 'string'
      ? input.SMTP_FROM.trim()
      : production
        ? ''
        : 'noreply@tenantcore.test';
  const smtpPort = Number(input.SMTP_PORT ?? (production ? 587 : 1025));
  const boolean = (key: string, fallback: boolean) => {
    const value = input[key];
    if (value === undefined) return fallback;
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    throw new Error(`${key} must be true or false`);
  };
  const secure = boolean('SMTP_SECURE', false);
  const requireTLS = boolean('SMTP_REQUIRE_TLS', production);
  if (!smtpHost || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(smtpFrom))
    throw new Error('SMTP_HOST and a valid SMTP_FROM are required');
  if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535)
    throw new Error('SMTP_PORT must be a valid port');
  if (production && !secure && !requireTLS)
    throw new Error('Production SMTP requires TLS');
  if (Boolean(input.SMTP_USER) !== Boolean(input.SMTP_PASSWORD))
    throw new Error('SMTP_USER and SMTP_PASSWORD must be configured together');
  return {
    ...input,
    NODE_ENV: nodeEnv,
    DATABASE_URL: databaseUrl,
    WEB_ORIGIN: webOrigin,
    PORT: port,
    SMTP_HOST: smtpHost,
    SMTP_FROM: smtpFrom,
    SMTP_PORT: smtpPort,
    SMTP_SECURE: secure,
    SMTP_REQUIRE_TLS: requireTLS,
  };
}
