# Isolated fictional demonstration

This is a local demonstration, not a public deployment. It uses its own database,
Mailpit ports and Compose project. Existing development/test databases are not
used or reset. Requirements: the README's Node/pnpm/Docker versions.

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm --filter api exec prisma generate
pnpm build
docker compose -p tenantcore-demo -f compose.demo.yaml up -d --wait
```

Copy `deploy/demo.env.example` to `.env.demo.local` without overwriting an
existing file. Choose `DEMO_SEED_PASSPHRASE` (15–128 characters) in that ignored
local file. All seeded accounts use this fictional passphrase on first creation.
Do not reuse a personal password or publish the file. No passphrase is printed.

Node 24 can load this file without putting credentials into command history:

```sh
pnpm --filter api exec node --env-file=../../.env.demo.local node_modules/prisma/build/index.js migrate deploy
pnpm --filter api exec node --env-file=../../.env.demo.local dist/demo/seed-cli.js
```

The equivalent `prisma db seed` config is also present, when the environment is
already loaded. Seeds never run implicitly during build/start/migrate. The CLI
rejects production, non-loopback hosts, names other than `tenantcore_demo`, missing
passphrases, foreign rows and incomplete fixture collisions. The database role
must own only this disposable demo database; these guards are not a replacement
for database permissions.

Start the API and web in separate terminals:

```sh
pnpm --filter api exec node --env-file=../../.env.demo.local dist/main.js
pnpm --filter web exec node --env-file=../../.env.demo.local node_modules/next/dist/bin/next dev --hostname 127.0.0.1 -p 3400
```

Open [the demo](http://localhost:3400) and [demo Mailpit](http://localhost:28025).
Both must remain on loopback. The seeded, verified identities are fictional:

| Account | Northstar Studio | Harbor Collective |
| --- | --- | --- |
| `avery@example.test` | OWNER | VIEWER |
| `jordan@example.test` | ADMIN | OWNER |
| `sam@example.test` | VIEWER | No access |

Sign in with the passphrase from the local file. Open Northstar's Dashboard for
three members, one initial pending invitation, role counts and initialization
activity. The fixture invitation's raw secret is deliberately discarded; use
Reissue to send a usable link to the private Mailpit inbox. Pending links expire
after 24 hours, so the count can naturally decrease. Create/invite/accept/edit
using fictional addresses to change actual metrics. Switch to Harbor as Avery
to confirm read-only access and denial of dashboard/member/audit management.

Rerunning seed preserves names, password hashes, sessions, member removal and
role changes; it does not reset the demo. It refuses newly added non-fixture users
or organizations rather than assuming they are safe to replace. For a deliberate
fresh baseline, first stop demo apps, verify the exact Compose project/volume and
explicitly recreate only the disposable demo database. Never reset a development
or production database. No destructive reset is bundled into the seed command.

Stop demo dependencies without deleting their volume:

```sh
docker compose -p tenantcore-demo -f compose.demo.yaml down
```

The API's `/live` checks the process and `/ready` checks PostgreSQL. HTTP replies
include `X-Request-Id`; correlate it with safe JSON completion/error logs. Keep
logs/inbox private. CI exercises the seed twice on a separately created/migrated
temporary database, including preservation and refusal of unrelated records.
