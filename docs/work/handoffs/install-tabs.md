# docs/install-tabs

Branch: docs/install-tabs (merged as PR #20)
Goal: Restore package-manager install tabs with page-scoped shared
selection; homepage button cleanup.

## Changed (exact)

- apps/docs/src/components/content/install-tabs.astro (new): self-contained
  tabbed-install component (tablist + command pre + page-scoped shared
  selection script + arrow-key support + scoped tab styles). Server renders
  the first command (npm), so the page is truthful without JavaScript.
- apps/docs/src/pages/index.astro: install block now uses <InstallTabs>
  (npm/bun/pnpm) inside the kept .entry-install frame; `star` button
  removed; buttons ordered github → docs → npm.
- apps/docs/content/getting-started.mdx: install + zod sections use
  <InstallTabs>; both groups on the page share one selection.

## Behavior contract

Clicking a tab in any <InstallTabs> on a page switches ALL <InstallTabs>
on that page to that manager (per-page scope; other pages unaffected).
Implemented by the component script re-querying
[data-package-manager-tabs] containers on astro:page-load and syncing
selection across all of them.

## Verification

- Docs format:check, lint, typecheck, build: PASS (before and after rebase
  onto the source-organization refactor)
- dist home: one tab group, managers npm/bun/pnpm, no star button, order
  github/docs/npm, npm command server-rendered
- dist getting-started: two tab groups, kaji + zod commands, bundled
  selection script present
- Deployed: PR #20 merge triggered docs-site run 35531274341, "Deploy to
  Cloudflare Pages" = success; live kaji.build verified (tab group + three
  managers, no star, button order, both getting-started groups)

## Next

Normal development.
