# TenantCore

An open-source SaaS reference built with Next.js, NestJS, PostgreSQL, Prisma and
TypeScript. The goal is a well-tested multi-organization product; the current
release implements the technical foundation and the first identity slice.

## What works today

- pnpm/Turborepo workspace, PostgreSQL Compose and versioned Prisma migrations.
- Database-backed API `/health` and runtime web `/status`.
- Account registration, login, authenticated account page, rotating sessions and logout.
- Argon2id passwords, hashed tokens, protected cookies, origin checks and request limits.
- API unit/HTTP/database tests, React component tests and a real Chromium journey.

Email verification/recovery, organizations, tenant authorization, invitations and
auditing are **planned**, not completed. Read the [roadmap](docs/roadmap.md).
Existing domain tables are not equivalent to implemented tenant features.

## Run locally

Requirements: Node.js 24, pnpm 12.14.0 and Docker Compose.

```sh
pnpm install --frozen-lockfile
docker compose up -d --wait
```

Copy `apps/api/.env.example` to `apps/api/.env` and `apps/web/.env.example` to
`apps/web/.env.local` (PowerShell: `Copy-Item source destination`; POSIX: `cp`).
Keep existing local environment files intact if already configured.

```sh
pnpm --filter api exec prisma generate
pnpm --filter api exec prisma migrate deploy
```

Start the apps in separate terminals:

```sh
pnpm --filter api start:dev
pnpm --filter web dev
```

Open [registration](http://localhost:3000/register), create a fictional account,
then sign in. `/account` shows the real API identity and supports renewal and
logout. `/status` remains available independently. The web proxies `/api/auth/*`
to `API_URL`; no token is exposed to browser JavaScript.

![Account page captured from the real browser test with a fictional user](docs/screenshots/account.png)

## Quality checks

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Typecheck generates Next.js route types before TypeScript, so it works without
an existing `.next`. Build requires network access for the configured Google
fonts, but does not require an online API/database.

HTTP/browser tests require a separate disposable database. Never point them at
the development or production database. The test setup rejects database names
other than `tenantcore_test`; test credentials below are local-only examples.

```sh
docker compose -p tenantcore-m1-test -f compose.test.yaml up -d --wait
```

Set these variables in the terminal used for the next commands:

```powershell
$env:DATABASE_URL = 'postgresql://tenantcore:test_password@localhost:55432/tenantcore_test'
$env:TEST_DATABASE_URL = $env:DATABASE_URL
```

POSIX equivalent:

```sh
export DATABASE_URL='postgresql://tenantcore:test_password@localhost:55432/tenantcore_test'
export TEST_DATABASE_URL="$DATABASE_URL"
```

```sh
pnpm --filter api exec prisma migrate deploy
pnpm --filter api test:e2e
pnpm build
pnpm --filter web exec playwright install chromium
pnpm --filter web test:e2e
docker compose -p tenantcore-m1-test -f compose.test.yaml down
```

Browser tests start their own API on 3301 and web dev server on 3300, with no
mock backend; keep those ports free. They use fictional accounts in the test
database. The CI runs all these gates on Linux with PostgreSQL. Unit tests need
no running database. Unset test env variables before returning to development.

## Architecture and security

- [Identity flow and boundaries](docs/architecture/identity.md)
- [Authentication/session ADR](docs/adr/0001-authentication-and-sessions.md)
- [OpenAPI contract](docs/api/openapi.yaml)
- [Roadmap and verified baseline](docs/roadmap.md)

API configuration validates `DATABASE_URL`, `WEB_ORIGIN`, `PORT` and `NODE_ENV`
at startup. Production requires an HTTPS `WEB_ORIGIN`, `NODE_ENV=production`,
HTTPS termination, and the web/API behind the documented same-origin proxy.
Production cookies use the `__Host-` prefix and Secure flag. Do not deploy
development cookie settings publicly. Rate limiting is single-process; shared
storage and a trusted-proxy policy are prerequisites for multiple instances.

The identity migration is additive: existing users and memberships remain;
legacy users have no fabricated credentials or verification. Roll back an app
deployment by returning to the prior release and retaining the additional tables;
do not drop credential/session data as an automatic rollback. Review backups and
a forward migration if a schema change is needed.

No public demo or production readiness is claimed yet. The root package currently
declares ISC; a repository-wide license file and API package license alignment
remain a maintainer decision before a formal release.
