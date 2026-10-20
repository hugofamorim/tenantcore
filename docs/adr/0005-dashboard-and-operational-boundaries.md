# ADR 0005: dashboard, safe request telemetry and demonstration boundaries

Status: accepted for TC-011 (M4), 2026-10-20.

## Verified baseline and delivery

Main `3eb31fe` includes merged M3 with passing CI 39457342787. Local baseline
lint/typecheck, 30 API unit tests, 29 frontend tests and builds passed. Existing
identity, tenant, invitation and ownership workflows remain in place.

Deliver incrementally: administrative dashboard and personal name settings;
safe request/error telemetry and health/readiness; isolated fictional seed;
browser acceptance, documentation and deployment runbook. Public hosting needs a
chosen host/domain and production SMTP; no public deployment is implied by local
acceptance. M5 remains out of scope.

## Decisions

- The dashboard requires verified OWNER/ADMIN membership. MEMBER/VIEWER retain
  organization overview/settings read access, but do not gain management metrics
  or audit access. Lock the organization before reauthorizing and aggregating,
  sharing the existing write protocol. Return membership totals/by-role, pending
  unexpired invitation count and five recent tenant audit projections. Pending is
  a stored-status/expiry metric, not a promise that an inviter still has permission.
  No cross-tenant count, email, secret, raw metadata or personal auth event leaks.
- Name settings modify only the authenticated account, not email, password or
  tenant roles. Keep credential changes in the existing recovery flow. Record
  personal audit without the old/new name value; lock the user as other identity
  writes do. No new schema is required for this slice.
- Generate a fresh UUID for every request; ignore caller-provided IDs. Return it
  as X-Request-Id. Log one bounded completion record (method allowlist, server
  route template, status, duration, request ID), never URLs/params/queries,
  headers, cookies, bodies, email, user IP or error objects. Production Nest logs
  are JSON. Unexpected errors are public generic 500s and safe correlated error
  events; middleware JSON/size errors retain 400/413 without echoing bodies.
- Preserve database-backed `/health` compatibility for the web and add minimal
  `/live` and `/ready` probes. Readiness verifies PostgreSQL with a bounded query
  timeout; none of the probes expose connection strings, internal diagnostics or
  dependency versions. `/status` shows API availability without publishing DB
  topology. SMTP acceptance is not readiness/delivery proof.
- Seeds are explicit, never run by migrate/build/start. Accept only non-production
  loopback `tenantcore_demo`, require an operator-supplied fictional passphrase,
  and refuse preexisting non-fixture records. Stable fixture IDs, transactional
  advisory locking and upserts make reruns non-duplicating. Preserve existing
  fixture password hashes, sessions and edits; do not reset privileges on rerun.
  No raw invitation secrets, real email addresses or public shared passwords.
- Demonstration has its own PostgreSQL/Mailpit Compose project and ports, bound to
  loopback. Public deployment must not expose Mailpit, database or internal API.
  HTTPS, production cookie flags, actual SMTP, backups, migrations and operational
  limits are documented before any public release. Local tests do not establish
  production readiness or a public-demo acceptance result.

## References

[Nest logger](https://docs.nestjs.com/application/logger),
[Nest exception filters](https://docs.nestjs.com/exception-filters),
[Prisma 7 explicit seeds](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/seeding).
