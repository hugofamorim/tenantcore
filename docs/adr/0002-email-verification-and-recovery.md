# ADR 0002: Single-use email actions and SMTP delivery

Status: accepted for the second M1 slice.

## Decisions

- Use a purpose-scoped EmailAction with a random 256-bit token, only its SHA-256
  hash in PostgreSQL, a 30-minute verification / 15-minute recovery lifetime,
  and a consumed timestamp. Issuing a newer token invalidates older tokens of
  that purpose. GET requests never consume tokens; confirmation requires POST.
- Serialize issue/consume/reset with the existing user-row lock. Password reset
  updates Argon2id credentials and revokes every session and outstanding email
  action in one transaction. Login must use the same lock while verifying the
  current hash, so an old-password login racing with reset cannot survive it.
- A valid reset proves email ownership and sets emailVerifiedAt if necessary;
  legacy users without credentials can enroll by proving control of their email.
  Verification alone does not log a user in or grant tenant permissions.
- Send links using the configured WEB_ORIGIN, never request Host headers. Put
  the secret in a URL fragment (not a query parameter), do not auto-submit it,
  and remove it after confirmation. Use no-referrer/no-store/noindex headers on
  token pages. No token or password is returned in JSON, logged or stored in
  localStorage/sessionStorage. The email token exists transiently in the fragment
  and the confirmation request; session tokens stay HttpOnly.
- SMTP is the only delivery adapter. Local/test Mailpit captures fictional mail
  without relaying it. Production requires explicit SMTP host/from and encrypted
  SMTP (TLS or required STARTTLS), with certificate validation left enabled.
- Request endpoints return the same 202 immediately for known/unknown/already
  verified accounts; bounded background delivery removes SMTP/account lookup
  timing from that response. A 32-job in-process queue with two workers is
  deliberately non-durable: restart or delivery failure may lose mail, so the
  user resends. Failures log a fixed safe message, never raw SMTP errors/PII.
  Shutdown drains accepted work. This is not a reliable distributed outbox.
- Keep endpoint/IP throttling and add a per-user/per-purpose 60-second issuance
  cooldown under the lock to limit recipient abuse across caller IPs. Generic
  responses also cover cooldown/queue-full/delivery failures. Retained hashes
  and consumed tokens need retention cleanup before a long-lived deployment.

## Trade-offs and acceptance

Durable mail delivery would require an encrypted outbox (raw links must not be
stored as plaintext) and retry/retention/key-management policies. That is deferred
instead of adding Redis or storing plaintext secrets in jobs. Monitor fixed mail
failure events and offer explicit resend; do not claim delivery from HTTP 202.

Tests must cover real SMTP capture, normalization and generic replies, purpose
confusion, random/expired/consumed/replaced tokens, concurrent consumption,
password-reset/session races, production SMTP configuration and complete browser
verification/recovery. The earlier login-before-verification policy remains for
personal identity; future tenant access must validate verified membership.

Reference: [OWASP forgot-password guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)
and [Nodemailer SMTP options](https://nodemailer.com/smtp).
