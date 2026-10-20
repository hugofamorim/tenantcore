# Contributing

Use Node 24, the lockfile's pnpm version and Docker Compose. Follow README setup;
never commit `.env` files, credentials, `.next`, generated Prisma code or captured
mail. Code, product docs and commits use English.

Create a focused branch/PR with a concrete problem, resulting behavior, actual
test evidence, screenshots for UI, migration notes and remaining limits. Preserve
existing work and the stable main branch. Do not disable quality checks.

Run frozen-lockfile install, Prisma generate, lint, typecheck, tests and build.
HTTP/browser tests require the isolated `tenantcore_test` database and private
SMTP capture; never point them at development/production. Browser project groups
start fresh servers to preserve real rate limits. See README for all commands.

Tenant authorization belongs to the API: verified identity, current membership,
organization-relative role and scoped resource lookup on every operation. Share
the organization lock for tenant mutations and audit the write in the same
transaction. Personal settings remain outside tenant scope. Never log raw
requests, URLs containing secrets, tokens, hashes or upstream error objects.

Review the ADRs and OpenAPI before changing contracts. Add meaningful negative,
cross-tenant and concurrency tests for policy/consistency changes. Keep SQL-only
constraints in existing migrations. Use forward versioned migrations, not
`db push` as a production workflow. No schema migration is needed when the existing
schema already supports a feature.

Use only fictitious data. Demo seed is explicit and restricted; local/CI checks do
not prove public deployment acceptance. Public release licensing alignment remains
a maintainer decision as noted in README; do not invent licensing grants.
