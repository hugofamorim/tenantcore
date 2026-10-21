# UI/UX implementation plan

Status: TC-013 first delivery implemented; review and published CI tracked in its PR.
Product language remains English.
Visual direction: neutral SaaS surfaces, a blue accent, clear hierarchy and subtle
motion. Architecture and boundaries are recorded in
[ADR 0006](adr/0006-ui-foundation-and-motion.md); component ownership and test
instructions are in the [UI foundation guide](architecture/ui-foundation.md).

| Slice | Deliverable | Acceptance |
| --- | --- | --- |
| 1 — TC-013 (implemented) | Tokens, Geist, shadcn/ui primitives, themes, responsive workspace navigation and dashboard | Local checks passed; maintainer review and exact published CI evidence tracked in the PR. |
| 2 — planned | Login, registration, verification, recovery and account UI | Preserve non-enumerating responses, input semantics, pending/error states, autocomplete and session navigation. |
| 3 — planned | Organization forms, members, invitations and audit UI | Clear hierarchy, readable tables, filters and safe destructive confirmations; preserve API authorization and pagination. |
| 4 — planned | Landing, service status and remaining visual consistency | Real capabilities only; accessible failures and consistent desktop/mobile themes. |

Each slice gets a focused branch/PR with coherent commits for decisions,
foundation, functional UI and verification evidence as appropriate. Do not add
unrelated infrastructure or new business capabilities to a UI migration.

## TC-013 local evidence

Frozen-lockfile installation and Prisma generation completed. Lint, generated-type
typecheck, 40 API unit tests, 39 frontend unit/component tests, 79 HTTP/PostgreSQL
tests and both production builds passed. All five Chromium journeys passed across
identity/organizations, collaboration and operations (163 tests total).

The operations journey also verifies light/dark/system persistence, absence of
hydration errors, current-page navigation, keyboard account menus, mobile sheet
focus trapping/restoration and navigation, long-name overflow at mobile/tablet
widths, reduced motion and removal of metrics after an unavailable response.
Selected axe WCAG A/AA rule-tag audits pass on light/dark dashboards and mobile navigation;
this does not certify the whole application as WCAG compliant.

A follow-up Windows shutdown diagnostic passed 77 HTTP tests with open-handle
detection and the two subprocess-based seed tests separately in normal mode.
No API implementation, schema, migration or deployment change was required.
The local developer server was preserved; browser test output is isolated.
Real captures are linked in README. The PR records final Linux CI evidence;
public demonstration hosting remains deferred independently of this UI delivery.

## Theme consistency follow-up

Legacy cards and form surfaces now share the dashboard's semantic palette across
authentication, account, organization, membership, audit and public screens.
Native role/organization selects share a component, explicit option colors and
the root color scheme. This corrects theme coverage without bringing forward
the later screen redesigns or changing API behavior.

All 41 frontend component tests and six Chromium journeys passed locally. The
new appearance journey compares rendered colors in both themes and audits account
and invitation accessibility; dark captures are linked in README. On Windows,
the initial default Vitest run failed to start its workers before executing tests;
a separate run with `--maxWorkers=2` passed all 41. CI retains the default command.
Final published quality-gate evidence is recorded in the PR.

## Review checklist

- Real API data; no fabricated charts, growth figures or mock-only workflow.
- Light/dark/system modes, persisted preference and no theme hydration errors.
- Keyboard reachability, visible focus, semantic labels and dialog focus return.
- Active navigation and organization identity remain unambiguous per browser tab.
- Mobile navigation closes safely; long names/emails do not widen the viewport.
- Loading, empty, denied, unavailable and successful states remain distinct.
- Reduced-motion users can use all controls; animations do not delay actions.
- Lint, generated-type typecheck, tests, builds and CI remain enabled.
- Record executed checks separately from planned acceptance; attach real captures.
