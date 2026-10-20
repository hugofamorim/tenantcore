# Delivery roadmap

## Verified baseline — 2026-10-20

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

## Later milestones (planned)

- M2: organization creation/switching, membership policies and tenant isolation.
- M3: invitations, membership lifecycle, ownership and audit records.
- M4: real dashboard, accessibility, deploy/demo and operational hardening.
- M5: optional post-MVP extensions only after M1–M4 acceptance.
