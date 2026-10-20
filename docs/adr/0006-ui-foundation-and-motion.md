# ADR 0006: incremental UI foundation and purposeful motion

Status: accepted for TC-013, 2026-10-20.

## Context

The maintainer selected a sober SaaS direction: neutral surfaces, a blue accent
and clear hierarchy. The verified functional baseline is main `b512f8b`, with
passing M4 CI and 159 tests. TC-012's roadmap-only PR is independent of this work.
The web uses Next 16.4.2, React 19.3 and Tailwind 4. Geist is loaded but overridden
by Arial; system dark mode and class-based dark utilities currently disagree.
Organization navigation, loading states and cards repeat presentation classes.

## Decisions

- Adopt shadcn/ui with Radix primitives inside `apps/web/src/components/ui`.
  These are owned source files, not an opaque theme package. Install only used
  components; keep shared packages out until there is another consumer. Review
  generated components as code and record the CLI version used in the UI guide.
- Define semantic CSS variables for surfaces, text, borders, accent and focus.
  Use Geist consistently. Use next-themes' class strategy with light/dark/system
  choices; defer the theme control until mounted to avoid hydration disagreement.
  The root stays a Server Component; the documented html-only hydration warning
  exception is limited to next-themes' pre-hydration theme attribute mutation.
- Extract a presentational workspace shell from OrganizationsPanel. Keep current
  API calls, session behavior, per-tab URL tenant selection, pagination and role
  checks in their existing controller. Pass validated public data and callbacks
  to the shell. Frontend visibility never replaces API authorization.
- Use a persistent desktop sidebar, active navigation, a labelled native tenant
  selector, a keyboard-accessible account menu and a modal mobile navigation
  sheet. Preserve native selection and existing accessible names. Focus trapping,
  Escape and focus restoration belong to Radix rather than custom key handlers.
- Use Motion for React via the `motion` package. Isolate it in dashboard client
  presentation with LazyMotion/m and reduced-motion preferences. Use short
  opacity/translation transitions without animating metric values or delaying
  critical feedback. Do not animate protected content out across tenants.
- Keep dashboard loading, real zero counts, denied/unavailable and empty states
  explicit. On a refresh, distinguish old data from loading and remove stale
  metrics on failure. Do not invent trends, activity series or percentages that
  are not provided by the existing contract.

## Delivery and acceptance

1. Record this decision and the staged UI plan.
2. Add the component/theme foundation, pinned direct dependencies and lockfile.
3. Deliver workspace navigation and real-data dashboard as one functional slice.
4. Verify keyboard/mobile/theme/reduced-motion behavior, preserve existing browser
   journeys and capture real desktop/mobile/dark screenshots. Run lint, typecheck,
   unit/component tests, HTTP tests and builds; publish a reviewable PR and verify
   its exact commit's Linux CI before calling it accepted.

Authentication forms, account forms, membership tables, invitation forms and the
landing page remain later UI slices. They inherit the font/theme foundation but
their business logic and layouts are not rewritten here. No API/schema/migration
or public deployment change is required.

## Trade-offs

Owned primitives need maintenance and accessibility regression tests. Radix,
icons, themes and Motion add client dependencies; keep Motion out of global page
rendering and prefer CSS for ordinary hover/focus feedback. Global typography
and theme changes affect legacy screens, so their existing browser journeys and
contrast must be checked during migration. Do not add a form or table framework
solely for this visual delivery.

## References

- [shadcn/ui existing Next.js applications](https://ui.shadcn.com/docs/installation/next)
- [shadcn/ui theming](https://ui.shadcn.com/docs/theming)
- [Next.js theme integration](https://ui.shadcn.com/docs/dark-mode/next)
- [Motion installation](https://motion.dev/docs/react-installation)
- [Motion accessibility](https://motion.dev/docs/react-accessibility)
- [Motion bundle boundaries](https://motion.dev/docs/react-reduce-bundle-size)
