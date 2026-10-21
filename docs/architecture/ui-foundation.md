# Frontend UI foundation

TC-013 introduces the first visual slice: workspace navigation and the live
dashboard. [ADR 0006](../adr/0006-ui-foundation-and-motion.md) explains the choices;
the [UI plan](../ui-implementation-plan.md) tracks later screen migrations.

## Ownership and boundaries

`components/ui` contains shadcn/ui source generated with CLI **4.22.1**, using
the Radix/new-york style, then reviewed and formatted locally. Imports use our
`lib/utils.ts` `cn` helper (clsx + tailwind-merge); do not add a second `cn` package
when updating generated components. `components.json` records paths and style.
Generated code must undergo the same review as handwritten code.

`OrganizationsPanel` continues to own identity, organization loading, pagination,
settings mutations and sign-out. `WorkspaceShell` takes public data and callbacks
and owns presentation: desktop sidebar, mobile sheet, active links, organization
selector, account menu and theme control. The API remains the authorization
boundary. Changing the selected organization navigates to its URL and does not
write a global tenant to localStorage. Each sidebar instance has a unique labelled
native selector, including when the mobile portal is open.

`DashboardPanel` is dynamically imported only when requested, so ordinary workspace
pages do not eagerly load its Motion subtree. It retains the existing dashboard
contract. Its small presentation
components render actual metrics, role counts and safe activity labels. Loading
uses skeletons without invented counts; refresh disables repeat submissions and
replaces stale content with loading. Failure removes prior metrics. The existing
keyed dashboard is replaced when its tenant changes, so outgoing protected data
is not retained for an exit animation.

## Visual system

`app/globals.css` defines semantic surface/text/accent/border/focus tokens for
light and dark themes. Prefer `bg-card`, `text-muted-foreground`, `border-border`
and related tokens over per-screen fixed colors. Primary blue identifies actions
and active navigation; neutral surfaces keep information readable. Use Geist via
the existing next/font variables. Do not add a second font download mechanism.

`next-themes` controls a single `html` class with light/dark/system choices and
persists only the visual preference. Its initial script prevents a wrong-theme
flash. The root's `suppressHydrationWarning` is limited to the html element that
this script updates, as documented by shadcn; it must not be copied to arbitrary
components to hide hydration bugs. Theme-specific icons use CSS, and menu content
is mounted only on interaction rather than rendering mismatched theme labels.

Existing forms inherit the font/theme foundation. Their full component migration
is a later slice; preserve field names, labels, native form behavior and secure
authentication navigation when working on those screens.

All content cards, including legacy authentication, account, organization and
status screens, use `bg-card text-card-foreground`. In dark mode this is the
dashboard's blue surface (`#111c2e`) over `bg-background` (`#0b1120`). Inputs use
the same surface; borders and secondary text use semantic tokens. Avoid local
`bg-white`/`dark:bg-zinc-*` overrides, which disconnect screens from the palette.

`NativeSelect` centralizes organization and role selectors without changing
native keyboard, form submission, reset or disabled behavior. The root theme
declares `color-scheme`; option/optgroup surfaces use popover tokens and selected
options use accent tokens. Native popup rendering remains browser/OS dependent;
the color scheme supplies the platform hint alongside explicit option colors.
Use this component for future native selects rather than duplicating styles.

## Interaction and accessibility

- Links expose `aria-current="page"`. A skip link reaches the main workspace.
- Mobile navigation uses the shadcn Sheet/Radix Dialog for focus trapping, Escape,
  background isolation and trigger focus restoration. Do not implement a second
  keyboard trap around it. The sheet closes on navigation/organization selection.
- Account and appearance controls use Radix menus with keyboard navigation.
- Motion is imported only by the dashboard client subtree, using LazyMotion/m
  with a 200 ms entry transition. Metrics themselves are never animated values.
  `MotionConfig` and `useReducedMotion` respect the OS preference; CSS transitions
  and skeleton/menu animations also reduce motion through a media query.
- Loading and errors remain semantic, independent of animation completion.
- Long organization/user content must truncate or wrap without widening the page.

## Updating components

Run commands from the repository root and review the entire resulting diff:

```sh
pnpm dlx shadcn@4.22.1 add <component> -c apps/web
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Install only components used in the current slice. Root `pnpm-lock.yaml` is the
monorepo dependency source; avoid incidental rewrites of the legacy nested web
lockfile/config. Review future CLI dependency suggestions, helper imports and CSS
changes before committing. Pin new direct dependencies and commit the root lock.

Use the existing isolated database and browser instructions in CONTRIBUTING for
full regression. Browser acceptance should cover light/dark/system persistence,
mobile sheet focus and navigation, role-aware links, per-tab tenants, reduced
motion and axe WCAG 2.2 AA checks on the changed dashboard. Automated audits do
not establish complete WCAG compliance; inspect the real desktop/mobile captures
and perform keyboard checks as well. Record actual results in the PR.

Playwright starts Next with `TENANTCORE_BROWSER_TESTS=1`, selecting the ignored
`.next-e2e` output and `tsconfig.e2e.json`. This avoids competing with a developer's
running Next server for the default dev lock. The test config extends the same
strict compiler options; no type/build checks are disabled. Next still regenerates
the ignored `next-env.d.ts`; run the normal `pnpm typecheck` after browser tests
to regenerate its default-output references. Do not run type generation, builds
and browser servers concurrently against the same output directory, or HTTP and
browser suites concurrently against the same test database.
Browser assertions allow 10 seconds for development's cold route compilation;
the total journey timeout and every functional/accessibility assertion remain
enabled. This is not a production latency budget.

The `appearance` browser project compares actual card colors against the live
dashboard across account, authentication, organization, collaboration and public
screens in both themes. It checks native option colors/color scheme, runs axe on
account and invitation screens, and captures dark-mode evidence. Run it through
`pnpm --filter web test:e2e`, which starts fresh API/web servers for each of the
four project groups to preserve production rate limits. The component suite also
covers native selector submission, reset and disabled behavior.
