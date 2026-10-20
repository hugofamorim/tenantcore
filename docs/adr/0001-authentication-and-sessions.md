# ADR 0001: API-owned credentials and opaque rotating sessions

Status: accepted for the first M1 slice; email verification/recovery remain planned.

## Context

The NestJS API owns identity and future tenant authorization. Next.js already
uses Cache Components; builds must not require a running API. Existing users
and memberships must survive the authentication migration.

## Decision

- Separate optional one-to-one `PasswordCredential` from `User`. Add nullable
  `emailVerifiedAt`; existing users acquire no invented password. Normalize new
  account email by trimming and lowercasing; preserve passwords exactly.
- Hash passwords with Argon2id (19 MiB, two iterations, one lane, random salt,
  32-byte output). Allow 15–128 characters without composition rules. Use a
  dummy hash for unknown-user login; return the same invalid-credentials error.
- Use cryptographically random 256-bit opaque access and refresh tokens, with
  only SHA-256 digests in PostgreSQL. This avoids JWT revocation complexity;
  every authenticated request checks session state in the API.
- Access expires after 15 minutes. A login creates a refresh family with a fixed
  seven-day absolute lifetime. Rotation replaces both tokens atomically, revokes
  the predecessor, and keeps its hash until retention cleanup is introduced.
  Reuse of a revoked refresh token revokes the entire family, including its
  current access token. Expired tokens cannot renew. Logout revokes the family
  and clears both cookies. Concurrent refreshes are treated as replay: clients
  coordinate refresh in one in-flight request; no replay grace window.
- Cookies are HttpOnly, SameSite=Lax, host-only, Path=/; Secure in production.
  Production uses `__Host-` names. Tokens never enter JSON, localStorage or logs.
  Cookie-backed identity responses use `Cache-Control: no-store`.
- Browser calls `/api/auth/*` on the web origin; Next.js proxies to NestJS.
  The API requires an exact configured `WEB_ORIGIN` on all auth POST requests,
  including login/register, and rejects missing/foreign/`null` origins. Only JSON
  mutations are accepted (logout/refresh may have empty bodies). This plus
  SameSite cookies protects against CSRF; CORS alone is not the protection.
  Non-browser clients must send Origin explicitly. No proxy header is trusted
  to derive the allowed origin or caller IP. TLS termination must preserve Origin.
- In-memory rate limits apply to auth endpoints and are intentionally single
  process. Never blindly trust X-Forwarded-For. A multi-instance deployment needs
  shared throttling storage and an explicit trusted-proxy policy before scaling.
- Register returns a generic result for existing/new email without logging in,
  so duplicates don't disclose accounts. Login creates fresh session identifiers.
  `GET /auth/me` exposes only the public user projection. UI session state is
  convenience only: NestJS remains the security boundary.

## Alternatives and consequences

A hosted identity provider adds operational/vendor dependencies; an in-process
web-only library would split the API security boundary. Stateless JWTs make
immediate logout/replay revocation harder. Opaque sessions require a database
lookup per request, acceptable for this MVP. Password hashing has deliberate
CPU/memory cost; request limits and bounded bodies reduce abuse but do not
replace edge protections or a production security review.

The first slice permits login before email verification for personal identity;
it must not imply ownership of that email for invitations or tenant access.
Verification/recovery, mail delivery, session cleanup, breached-password checks,
MFA, distributed limits and audit events are explicit follow-up work.

## References

- [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [OWASP CSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- Next.js 16.4.2 bundled authentication and rewrites documentation.
