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
  return {
    ...input,
    NODE_ENV: nodeEnv,
    DATABASE_URL: databaseUrl,
    WEB_ORIGIN: webOrigin,
    PORT: port,
  };
}
