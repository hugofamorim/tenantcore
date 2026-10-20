# Delivery roadmap

## Current acceptance — 2026-10-20

M0–M3 are implemented and merged. M4's functional/local demonstration delivery
is accepted: the maintainer reviewed it locally and confirmed the expected
behavior. [PR #5](https://github.com/hugofamorim/tenantcore/pull/5) merged at
`b512f8b0b6804fe1ba0a280983c882bc5d4424fd`; the
[main CI](https://github.com/hugofamorim/tenantcore/actions/runs/39477710424)
completed successfully for that exact commit.

The accepted baseline includes 159 tests (40 API unit, 35 frontend, 79 HTTP/
PostgreSQL and five browser journeys), lint, typecheck and production builds.
The M4 local checks below also cover type generation without an existing `.next`,
fresh database migrations, repeatable fictional seeding and proxy validation.
These are acceptance results for the delivered implementation, not a promise
that checks have been rerun for every subsequent documentation change.

Public publication remains deferred by maintainer choice. This acceptance does
not close M4's public-demo criterion, certify production readiness or begin M5.
No release tag or public demo URL is claimed. See the prioritized follow-ups below
and the [deployment procedure](operations/deployment.md).

## Historical baseline — 2026-10-20

The following M0–M3 notes preserve the evidence and branch state at each delivery;
their references to open PRs are historical. PRs #1–#5 are now merged.

TC-007 at `4c0e7a1fae7807a815b7d1c98e4cb13e565bf5c8` has passing lint,
typecheck, two API unit tests and production builds locally and in
[CI](https://github.com/hugofamorim/tenantcore/actions/runs/39426147430).
PR #1 is still open; TC-008 builds on its working integration without merging it.

Implemented: pnpm/Turbo workspace, Next.js web, NestJS API, PostgreSQL Compose,
Prisma migrations and User/Organization/Membership models, database-backed
`GET /health`, runtime web `/status`. Organization workflows and authentication
were not implemented. The web had no tests; the API HTTP test still expected
the removed starter endpoint. M0 documentation/env setup needs completion.

## M1 — Identity & Authentication (implemented; acceptance tracked in PR #2)

Deliver in reviewable increments:

1. **Architecture (done):** session/cookie/CSRF/replay ADR and delivery plan.
2. **Persistence and hashing (done):** additive credentials/session migration, Argon2id
   service and hash tests. Preserve existing users and tenant relationships.
3. **First usable slice (implemented; CI acceptance tracked in PR):** register, login, me, refresh and logout; validated
   inputs, safe responses, origin checks and request limits; browser forms and
   account page; API/database and UI/browser tests; OpenAPI contract and setup.
4. **Email identity slice (implemented):** one-use email verification and password reset,
   hashed expiring tokens, dev mail delivery, non-enumerating recovery/resend,
   session revocation after password reset, forms and abuse/expiry tests.
5. **M1 acceptance (local checks passed; published CI tracked in PR):** verify the complete account recovery journey,
   review production security/deployment settings and update evidence.

The first slice alone did not complete M1. The second implements verification,
recovery and actual SMTP/browser acceptance. Unverified accounts can still use
personal identity only; no tenant API or authorization is exposed. Verification
must gate organization access when that capability is introduced in M2.

Local acceptance evidence on Windows / Node 24: frozen-lockfile installation,
lint without warnings, typecheck, seven API unit tests, seven web component/client
tests, sixteen HTTP/PostgreSQL tests and one real Chromium journey passed.
Production builds passed for both apps. Prisma validation and schema/database
diff passed; migrations were applied to both a clean isolated test database and
the existing local database. The CI now runs the HTTP and browser tests as gates.
The PR records the exact published SHA and final Linux CI result. This first-slice
evidence is superseded by the second-slice acceptance below.

Second-slice local evidence: nine API unit tests, eleven frontend tests,
twenty-seven HTTP/PostgreSQL tests and two Chromium journeys pass. Email tests
use a real local SMTP capture and cover expiry, reuse, replacement, purpose
confusion, delivery failure, generic responses, legacy enrollment and concurrent
reset/login. All static/build checks remain enabled. A cached unauthenticated
Next.js redirect discovered in the new journey is fixed by a new-document
navigation after session-cookie changes.

Remaining operational hardening (not hidden MVP functionality): durable encrypted
mail outbox, retention cleanup, distributed rate limits/trusted proxy setup,
production SMTP credentials and HTTPS deployment. No production deployment or
public demo is claimed. Next product milestone: M2 organization/RBAC workflows.

## M2 — Organizations and RBAC (implemented; CI acceptance tracked in TC-009 PR)

TC-009 starts from the green M1 commit `ca6b690`; PR #2 remains unmerged.
Implementation order and architectural decisions are in ADR 0003.

- Implemented: atomic organization/OWNER creation, bounded membership listing,
  organization details and OWNER/ADMIN name/slug updates.
- Implemented: verified-email gate on every organizational request, live
  membership/role checks, foreign/missing 404 parity and unknown-field rejection.
- Implemented: per-tab URL selection, organization sidebar, details/settings,
  read-only settings for MEMBER/VIEWER and loading/empty/error states.
- Validation: tenant/role positive and negative tests, membership revocation,
  rollback, concurrent slug collision, forms/client tests and browser journey.
- Schema: one additive membership listing index; no existing rows are changed.
- No invitation/member/role mutation, ownership transfer or audit claim in M2.
  Those are M3 and must use the same organization lock as settings writes.

Local acceptance: fourteen API unit tests, nineteen frontend tests, forty-five
HTTP/PostgreSQL tests and three real Chromium journeys. The organization journey
verifies email gating, two workspaces, per-tab switching, persisted settings,
desktop/mobile rendering and outsider denial. The new forms use unique IDs so
Next.js retained hidden pages cannot attach labels to another form. The PR records
the final published SHA and Linux CI result. No production deployment is claimed.

## M3 — Invitations, members and audit (implemented and merged)

TC-010 starts from merged M2/main `8e66061`. The initial baseline passed lint,
typecheck, 14 API/19 web unit tests, 45 HTTP/PostgreSQL tests and both builds.
ADR 0004 defines hierarchy, invitation lifecycle, ownership and audit boundaries.

PR #4 is merged at `3eb31fe`; its main CI 39457342787 passed. Historical milestone
notes above describe the branch state at the time; PRs #1–#3 are also merged.

- Implemented: email invitation before/after account creation, verified matching
  recipient acceptance, one-use hash/expiry, duplicate protection, reissue/revoke.
- Implemented: scoped member search/list, role changes/removal with hierarchy,
  sole-owner atomic transfer and safe rejection of ambiguous legacy ownership.
- Implemented: tenant audit with transactional mutation events and personal
  login/logout events excluded from tenant reads; no raw secrets in metadata.
- Implemented: member/invitation/audit UI, role badges, confirmation dialogs,
  new-account instructions and fragment-only explicit acceptance.
- Migration: additive Invitation/AuditEvent tables, pending-recipient partial
  uniqueness and invitation non-OWNER SQL check; existing rows remain intact.
- Validation targets: authorization/expiry/reuse, concurrent acceptance and
  ownership/removal, audit-failure rollback, real SMTP and two-account browser flow.

Final local acceptance: 30 API unit tests, 29 web unit/component tests, 66
HTTP/PostgreSQL tests and four Chromium journeys passed (129 total). Lint has no
warnings, typecheck (also without `.next`), both production builds, Prisma
validation and schema/database diff passed. The migration was applied to the
isolated test database and the existing local development database. Browser
projects use fresh servers between identity/organizations and collaboration to
preserve real rate limits without cross-suite quota interference. The TC-010 PR
records the published SHA and final Linux CI result.
No durable mail outbox, audit retention/external sink, organization deletion,
public demo or production deployment is claimed.

## M4 — Dashboard, robustness and local demonstration (TC-011)

Implemented and accepted locally: verified OWNER/ADMIN live dashboard; member totals/by-role,
pending unexpired invitation records and five safe recent tenant activities.
Personal display-name settings reject email/role/user assignment. Web has clear
forbidden/missing/unavailable states, product landing page and responsive dashboard.

Operational implementation: fresh server request IDs, bounded safe JSON request/
error logs, sanitized parser/internal failures, minimal live/ready probes and
bounded PostgreSQL readiness queries. API binds to loopback by default. No new
schema or dependency was necessary; existing migrations are retained.

Demonstration/preparation: guarded fictional seed, independent Compose services,
repeat-run/preservation tests on a freshly migrated temporary database, local demo
guide, contribution guidance, OpenAPI and HTTPS/rollback runbook with a Caddyfile.
Local smoke verified fictional login/metrics, role/tenant denial and probes. The
proxy config validates with Caddy 2.11.7 without opening ports or requesting certs.

Local acceptance passed: 40 API unit, 35 frontend unit/component, 79 HTTP/database
tests and five Chromium journeys (159 total); lint with no warnings, typecheck
including without `.next`, production builds, Prisma validation/empty schema diff,
OpenAPI YAML/internal references and Caddy configuration validation. Real demo
CLI seeding twice and an HTTP login/metrics/isolation/probe smoke also passed.
Published Linux acceptance passed for both the TC-011 branch and the merged main
commit linked above. Public hosting/DNS/SMTP,
trusted-ingress/edge abuse policy and external HTTPS acceptance are explicitly
pending by maintainer choice. Operational outbox/retention/distributed limits and
formal release licensing remain documented follow-ups. M4's public-demo criterion
is not claimed complete, and M5 has not started.

## Prioritized follow-ups (planned; no implementation started)

### M4 release closure — deferred public publication

1. Select host, domain, SMTP and a restricted fictional-demo enrollment policy.
   Record the ingress trust boundary and abuse limits before exposing the app.
2. Deploy to staging using the existing runbook, apply migrations once, and verify
   backup restoration, process restarts and protected environment configuration.
3. Run external HTTPS acceptance: certificate, secure cookies, Origin rejection,
   verification/recovery, invitations, role/tenant denial and health probes.
   Record the tested SHA, evidence and URL only after successful verification.
4. Resolve the documented release licensing follow-up with an explicit maintainer
   decision; align the repository license, package metadata and README.

Hosting/publication remains deferred; do not create infrastructure, publish shared
credentials or change the license implicitly to close this list.

### M5 candidates — ordering for planning only

M5 implementation remains gated on M1–M4 acceptance, including resolution of the
deferred public-demo criterion or an explicit maintainer scope decision.
Each candidate needs a separate issue, a small vertical delivery and an ADR when
it changes persistence, security or operational dependencies.

| Order | Candidate | Decision and acceptance before delivery |
| --- | --- | --- |
| 1 | Retention cleanup | Define retention per session/token/audit category; use bounded, repeatable batches; prove active records and tenant isolation are preserved. |
| 2 | Durable mail outbox | Define encryption/key handling, retry/expiry and delivery semantics; test SMTP failure, restart recovery and duplicate handling without logging secrets. |
| 3 | Rate-limit and ingress hardening | Choose the actual trusted proxy topology; add shared storage only for a justified deployment; test spoofed headers and independent visitor quotas. |
| 4 | Operational metrics and load evidence | Choose safe bounded metrics and target workloads; measure latency/error behavior without collecting credentials or tenant payloads. |
| 5 | Organization plans and limits | Define enforcement and concurrency semantics in an ADR; start without billing and test atomic quota checks across tenants. |

MFA, OAuth/SSO, billing/webhooks and PostgreSQL RLS remain optional later
explorations. They are not prerequisites for the accepted local MVP and are not
represented as implemented. The next implementation should address one concrete
need rather than introducing all operational infrastructure at once.
