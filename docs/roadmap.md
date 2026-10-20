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

## M1 — Identity & Authentication (in progress)

Deliver in reviewable increments:

1. **Architecture (done):** session/cookie/CSRF/replay ADR and delivery plan.
2. **Persistence and hashing (done):** additive credentials/session migration, Argon2id
   service and hash tests. Preserve existing users and tenant relationships.
3. **First usable slice (implemented; CI acceptance tracked in PR):** register, login, me, refresh and logout; validated
   inputs, safe responses, origin checks and request limits; browser forms and
   account page; API/database and UI/browser tests; OpenAPI contract and setup.
4. **Next slice (planned):** one-use email verification and password reset,
   hashed expiring tokens, dev mail delivery, non-enumerating recovery/resend,
   session revocation after password reset, forms and abuse/expiry tests.
5. **M1 acceptance (planned):** verify the complete account recovery journey,
   review production security/deployment settings and update evidence.

The first slice does **not** complete M1. Unverified accounts can use their
personal account only; no tenant API or authorization is exposed by this slice.
Verification must gate organization access when that capability is introduced.

Local acceptance evidence on Windows / Node 24: frozen-lockfile installation,
lint without warnings, typecheck, seven API unit tests, seven web component/client
tests, sixteen HTTP/PostgreSQL tests and one real Chromium journey passed.
Production builds passed for both apps. Prisma validation and schema/database
diff passed; migrations were applied to both a clean isolated test database and
the existing local database. The CI now runs the HTTP and browser tests as gates.
The PR records the exact published SHA and final Linux CI result.

## Later milestones (planned)

- M2: organization creation/switching, membership policies and tenant isolation.
- M3: invitations, membership lifecycle, ownership and audit records.
- M4: real dashboard, accessibility, deploy/demo and operational hardening.
- M5: optional post-MVP extensions only after M1–M4 acceptance.
