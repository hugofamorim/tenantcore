# ADR 0003: Explicit tenant URLs and organization-scoped authorization

Status: accepted for M2.

## Verified starting point and delivery order

M1 at `ca6b69017114d74299b69e370214b7b0dada65dc` has passing Linux CI,
49 tests and working account/email/session flows. PRs #1 and #2 remain open.
TC-009 branches from that working state without merging either prerequisite.
Organization/Membership tables exist, but organization workflows do not.

1. Add organization DTOs, policy, atomic creation, scoped reads and settings API.
2. Prove tenant/role isolation and rollback/concurrent slug collision behavior.
3. Add organization list/create, selector, details and settings pages.
4. Add UI/browser coverage, OpenAPI/setup/roadmap updates and publish a separate PR.

## Decisions

- An authenticated, email-verified personal identity is required for **every**
  organization operation, including list/create. Unverified accounts retain
  personal identity/recovery access from M1.
- A user may have many memberships with different roles. All four roles can read
  their organization; only OWNER and ADMIN can update its name/slug. No role is
  global. Membership is checked from PostgreSQL on every operation, not a cookie,
  client role or the UI's active selection.
- Creation atomically inserts an organization and its caller's OWNER membership.
  Choose **one owner per organization** for future ownership workflows. This
  slice exposes no membership/role changes or deletion, so it cannot remove or
  add owners after creation. M3 must enforce transfer/last-owner invariants under
  the organization lock and audit changes. Legacy rows are not silently repaired.
- Use stable UUIDs in `/organizations/:organizationId` and scoped backend queries.
  Unknown organizations and non-members both receive 404 with the same response.
  A known member with insufficient role receives 403. Never derive authority from
  X-Organization-Id, organization IDs in bodies or a cached browser selection.
- The active organization lives in the URL, per tab. Switching changes the URL;
  every subsequent request explicitly addresses that ID and is reauthorized.
  This supports reloads/bookmarks and independent tenants in different tabs
  without a mutable global/session tenant context.
- PATCH rechecks membership/role in the transaction, after locking the organization
  row. M3 membership mutations must take that same lock to avoid authorization
  changes racing with writes. Reads join the caller's membership in the query;
  no unrestricted resource is loaded and then returned on a stale UI assumption.
- Slugs are user-selected, trimmed/lowercased, 3–48 ASCII lowercase letters/digits
  separated by single hyphens, with no leading/trailing hyphen. Reserved system
  names are rejected. Global unique collisions return 409 with no automatic
  suffix; clients explicitly choose another slug. Slug availability is an
  intentional global namespace disclosure, not permission to read a tenant.
  Renaming a slug does not change the stable organization URL.
- Membership lists are paginated (default 20, maximum 100, offset bounded to
  10,000), with stable createdAt/id ordering and no global tenant counts. Add a
  membership user/order index; preserve existing data and schema history.
- Reuse cookie session/Origin validation and no-store responses from M1. Add a
  same-origin proxy only for organization routes. Domain policies remain in the
  API even when the UI hides editing controls.

## Boundaries and risks

This is application-level shared-database isolation. PostgreSQL RLS is **not**
implemented. Future tenant resources, search, exports, jobs and invitations must
carry a validated organization scope; ORM access alone is not a security policy.
No membership management, invitations, ownership transfer or audit trail is
claimed in M2. Those remain M3, with positive/negative/concurrency tests required.

References: [OWASP multi-tenant security](https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html)
and [Prisma v7 transactions](https://www.prisma.io/docs/orm/v7/prisma-client/queries/transactions).
