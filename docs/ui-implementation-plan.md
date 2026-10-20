# UI/UX implementation plan

Status: TC-013 first delivery in progress. Product language remains English.
Visual direction: neutral SaaS surfaces, a blue accent, clear hierarchy and subtle
motion. Architecture and boundaries are recorded in ADR 0006.

| Slice | Deliverable | Acceptance |
| --- | --- | --- |
| 1 — TC-013 | Tokens, Geist, shadcn/ui primitives, themes, responsive workspace navigation and dashboard | Existing identity/tenant flows pass; real metrics, keyboard controls, mobile navigation, dark mode and reduced motion work; screenshots and CI evidence recorded. |
| 2 — planned | Login, registration, verification, recovery and account UI | Preserve non-enumerating responses, input semantics, pending/error states, autocomplete and session navigation. |
| 3 — planned | Organization forms, members, invitations and audit UI | Clear hierarchy, readable tables, filters and safe destructive confirmations; preserve API authorization and pagination. |
| 4 — planned | Landing, service status and remaining visual consistency | Real capabilities only; accessible failures and consistent desktop/mobile themes. |

Each slice gets a focused branch/PR with coherent commits for decisions,
foundation, functional UI and verification evidence as appropriate. Do not add
unrelated infrastructure or new business capabilities to a UI migration.

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
