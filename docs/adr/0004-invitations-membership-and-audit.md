# ADR 0004: invitation lifecycle, membership hierarchy and audit

Status: accepted for TC-010 (M3), 2026-10-20.

## Context and delivery

M2 provides verified identity and organization-scoped authorization. M3 adds a
complete second-user journey: manager invitation, email delivery, verified account
acceptance, limited access, member administration, ownership transfer and audit.
Implement persistence/policies first, then HTTP operations, web journeys and tests.
M0–M2 passed local checks; M2 CI 39445761137 passed and PRs #1–#3 are now merged.

## Decisions

- A new organization has one OWNER. Ordinary invitations and role mutations never
  assign OWNER; an explicit transfer demotes the previous OWNER to ADMIN and
  promotes an existing verified member in one transaction. Owner removal and
  ordinary owner edits are forbidden, including self-removal. Transfer fails if
  legacy data has zero/multiple owners; migration does not rewrite that data.
- OWNER manages ADMIN/MEMBER/VIEWER. ADMIN manages only MEMBER/VIEWER and cannot
  change another ADMIN, the OWNER or themselves. MEMBER/VIEWER cannot manage or
  list members, invitations or audit logs. Listing exposes personal email only to
  managers of that organization. All lists are bounded and tenant scoped.
- Every tenant mutation locks the Organization row before reloading actor and
  target membership. Settings writes use the same lock. Acceptance also uses this
  lock and rechecks the inviter's current permission; removing/demoting an inviter
  makes invitations unusable when that role is no longer authorized. Actor authorization and
  audit insertion occur inside the same transaction as each domain mutation.
- Invitations contain 256-bit random secrets; only SHA-256 hashes are persisted.
  Links expire after 24 hours and use URL fragments, cleared before submission.
  GET never consumes a link. Acceptance requires authentication, verified email
  matching the normalized recipient, and explicit confirmation. New users register
  and verify normally, then reopen the email link; tokens are not stored in browser
  persistence or redirect query strings. Existing membership cannot be elevated by
  invitation. Concurrent acceptance has one winner; reuse fails safely.
- One PENDING invitation per organization/email (partial unique index). Expired
  pending invitations are retired before replacement; expiry is also checked at
  acceptance and projected as EXPIRED. Reissue rotates the hash and expiry on the
  same invitation; old links stop working immediately. Revoke is idempotent for
  revoked records and never reverses acceptance. Changes are audited.
- SMTP delivery occurs outside database transactions. Requests await delivery and
  return 503 on failure; compensation revokes only the matching token generation,
  with audit. A process crash or ambiguous SMTP acknowledgement can require manual
  reissue; no durable mail outbox is claimed. No plaintext secret is returned by API
  or logged. Rate limits apply to invitation sending and acceptance.
- Append-only application audit records contain action/resource IDs, actor ID,
  timestamp and explicitly selected non-secret metadata (roles/changed field
  names). Login success/logout are personal events; no public global audit route.
  Tenant managers can read only their tenant's events. No raw request body, token,
  password, session identifier or email is recorded as metadata. Actor deletion
  nulls its reference; organization deletion cascades tenant events. Retention and
  a tamper-resistant external sink remain operational follow-ups.

## Consequences and references

The API is the security boundary; UI permissions are affordances. Row locking
serializes changes within one tenant and deliberately favors correctness over
maximum write throughput. Application isolation is not PostgreSQL RLS. Membership
deletion immediately affects subsequent tenant requests without ending personal
sessions. Audit write failure rolls back the corresponding domain write.

Use the installed Prisma 7 transaction API, not Prisma 8 examples:
[Prisma 7 transactions](https://www.prisma.io/docs/orm/v7/prisma-client/queries/transactions).
Secret lifecycle follows the reusable token guidance in
[OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).
