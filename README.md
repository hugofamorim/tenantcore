# TenantCore

An open-source SaaS reference built with Next.js, NestJS, PostgreSQL, Prisma and
TypeScript. The goal is a well-tested multi-organization product; the current
release implements personal identity, organizations, invitations and membership management.

## What works today

- pnpm/Turborepo workspace, PostgreSQL Compose and versioned Prisma migrations.
- Database-backed API `/health` and runtime web `/status`.
- Account registration, login, authenticated account page, rotating sessions and logout.
- Email verification, one-use password recovery and revocation of all sessions on reset.
- Organization creation, membership-scoped list/details, per-tab switching and OWNER/ADMIN settings edits.
- Email invitations, member role/removal policies, atomic ownership transfer and tenant audit.
- Argon2id passwords, hashed tokens, protected cookies, origin checks and request limits.
- API unit/HTTP/database tests, React component tests and a real Chromium journey.

Dashboard metrics and production demonstration/deployment are **planned**.
Organization authorization applies to every implemented tenant route.
Read the [roadmap](docs/roadmap.md).
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
to `API_URL`; session tokens stay in HttpOnly cookies, outside browser JavaScript.

Open [local Mailpit](http://localhost:8025) for the verification message, follow
its link and confirm the action. Use "Forgot your password?" on sign-in to test
recovery. Recovery changes the password, proves email ownership and signs out
all existing sessions. Links expire (verification: 30 minutes; reset: 15 minutes)
and are single-use. Reissuing an eligible link invalidates older links of that
purpose. Check Mailpit rather than expecting external delivery in development.

Mailpit binds only to loopback (SMTP 1025, inbox 8025); keep it private. If an
existing `.env` lacks SMTP settings, development defaults match Compose. Never
use real personal/customer addresses in a demonstration or captured inbox.

![Account page captured from the real browser test with a fictional user](docs/screenshots/account.png)

![Recovery completion captured from the real SMTP/browser journey](docs/screenshots/recovery.png)

## Organizations

Verify your email, then open "Your organizations" from `/account` (or visit
`/organizations`). Create a workspace with a name and a unique slug. The caller
becomes its sole OWNER in the same transaction. Use the sidebar selector to
switch workspaces; selection is in the URL, so separate tabs remain independent.
Settings allow OWNER/ADMIN to edit name/slug; MEMBER/VIEWER get a read-only view.

Slugs are 3–48 lowercase ASCII letters/digits separated by single hyphens;
reserved names such as `admin`, `api`, `auth` and `settings` are rejected. Global
slug collisions return 409 instead of inventing a suffix. Renaming a slug does
not change the organization UUID or its bookmarked URL. The list is paginated
(20 by default, at most 100; offset at most 10,000) and only returns memberships
of the authenticated caller. The UI can load more pages into its selector.

Every organization API request requires an authenticated, email-verified user.
The server rechecks membership and organization-relative role. A foreign or
missing organization returns the same 404; a member with insufficient role gets
403. Settings reject user/tenant/role fields; a forged tenant header grants no
access. Management endpoints accept only their documented role or target fields.
Organization deletion is not exposed.

![Organization overview captured from the real browser journey](docs/screenshots/organizations.png)

The same journey checks mobile layout and independent organization context in
separate tabs; [mobile capture](docs/screenshots/organizations-mobile.png).

## Invitations, members and audit

OWNER/ADMIN see Members, Invitations and Audit log in the workspace sidebar.
Invite a fictional email with an allowed role, then open the invitation in Mailpit.
The recipient may create an account after receiving the invitation: register,
verify that same email, sign in, and reopen the invitation link to explicitly
accept. The link is not a login credential. It expires in 24 hours, is single-use,
and cannot select another tenant, recipient or role. No membership is created
until acceptance. An existing member cannot use an invitation to elevate a role.

OWNER can invite/manage ADMIN, MEMBER and VIEWER. ADMIN can invite/manage only
MEMBER/VIEWER; neither can edit/remove their own membership or mutate the OWNER
through ordinary member actions. Members and viewers cannot list personal member
emails, manage invitations or read audit logs. The member table supports name/email
search, bounded pagination, role badges and confirmation before sensitive changes.
Revocation invalidates an invitation; reissue replaces its previous link. Removing
or demoting an inviter also rechecks their permission when a recipient accepts.

Only OWNER can transfer ownership to an existing verified member. Transfer demotes
the old owner to ADMIN and promotes the target atomically, preserving one owner.
Legacy organizations with ambiguous owner counts require manual review; migrations
do not rewrite them. A removed member loses tenant access on the next request.
Tenant audit includes organization creation/settings, invitation lifecycle, member
changes and ownership transfer. Login/logout events are personal and not exposed
through tenant audit. No password, token, hash or raw request is audit metadata.

![Member management captured from the real two-account browser journey](docs/screenshots/members.png)

[Mobile member table](docs/screenshots/members-mobile.png) scrolls inside its
container while keeping navigation and page content within the viewport.

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
database. Test Mailpit uses SMTP 11025 and inbox 18025; tests pick those defaults
(CI explicitly uses 1025/8025). `SMTP_PORT` and `MAILPIT_URL` can override them.
`test:e2e` runs the identity/organization project, stops its servers, then starts
fresh servers for the collaboration project. This prevents independent fictional
accounts on the same loopback IP exhausting one another's real rate-limit budget;
no API limits are disabled or increased. For one journey, use
`pnpm --filter web exec playwright test --project=collaboration` (or
`--project=identity-and-organizations`). Both groups run in CI.
The CI runs all these gates on Linux with PostgreSQL and SMTP. Unit tests need
no running database. Unset test env variables before returning to development.

## Architecture and security

- [Identity flow and boundaries](docs/architecture/identity.md)
- [Organization isolation and role matrix](docs/architecture/tenancy.md)
- [Authentication/session ADR](docs/adr/0001-authentication-and-sessions.md)
- [Email verification/recovery ADR](docs/adr/0002-email-verification-and-recovery.md)
- [Organization and tenant authorization ADR](docs/adr/0003-organizations-and-tenant-authorization.md)
- [Invitation, membership and audit ADR](docs/adr/0004-invitations-membership-and-audit.md)
- [OpenAPI contract](docs/api/openapi.yaml)
- [Roadmap and verified baseline](docs/roadmap.md)

API configuration validates database, web origin, port, environment and SMTP
at startup. Production requires an HTTPS `WEB_ORIGIN`, `NODE_ENV=production`,
HTTPS termination, and the web/API behind the documented same-origin proxy.
Production cookies use the `__Host-` prefix and Secure flag. Do not deploy
development cookie settings publicly. Rate limiting is single-process; shared
storage and a trusted-proxy policy are prerequisites for multiple instances.

Production requires explicit `SMTP_HOST`/`SMTP_FROM`, `SMTP_PORT` (normally 587
with `SMTP_REQUIRE_TLS=true`, or 465 with `SMTP_SECURE=true`) and optional paired
`SMTP_USER`/`SMTP_PASSWORD`. TLS certificate validation remains enabled. Email
request endpoints return generic 202 responses, including unknown accounts,
cooldown and delivery failures; this is acceptance, not proof of delivery.
The 32-job/two-worker in-process mail queue is non-durable: resend after failure
or restart. A durable encrypted outbox and retention cleanup remain operational
hardening work. No tokens or raw SMTP errors are logged. Local Mailpit does not
relay messages externally.

Invitation sending/reissue awaits SMTP outside database transactions. Failure
returns 503 and revokes only that token generation; create a new invitation. A
crash or ambiguous delivery acknowledgement can require reissue. This flow does
not claim a durable mail outbox. The additive M3 migration introduces Invitation
and AuditEvent, a partial unique index for pending tenant/email invitations and a
check rejecting invitation OWNER roles. Keep these SQL constraints in future
migrations; Prisma's schema file alone does not describe them. Rollback retains
the added tables rather than discarding invitations/audit history.

The identity migration is additive: existing users and memberships remain;
legacy users have no fabricated credentials or verification. Roll back an app
deployment by returning to the prior release and retaining the additional tables;
do not drop credential/session data as an automatic rollback. Review backups and
a forward migration if a schema change is needed.

No public demo or production readiness is claimed yet. The root package currently
declares ISC; a repository-wide license file and API package license alignment
remain a maintainer decision before a formal release.
