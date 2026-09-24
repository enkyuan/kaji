# Active work

Task: `docs/link-title-consistency`

- State: `REVIEW`
- Owner: implementation
- Branch: `docs/link-title-consistency`
- Worktree: `/Users/enkyuan/Desktop/Projects/kaji-wt/docs-link-title-consistency`
- Base SHA: `aaf7864ec4d7af7569ba36a8e3bed546281af3f5`
- Goal: Use one header for docs footer link sections and make every cross-reference link title equal the target page's frontmatter title.
- Package source diff: none
- Public API diff: none

## Scope

- `apps/docs/content/getting-started.mdx`: unify `## Continue` to `## Related guides`; `Runnable refund example` → `Refund example`.
- `apps/docs/content/architecture.mdx`: `Timeout and cancellation` → `Cancellation`.
- `apps/docs/src/data/navigation.ts`: sidebar labels match page titles (`Getting started`, `API reference`, `Refund example`).

## Exit condition

PR merged into `main`, worktree removed, branch deleted.

Handoff: `docs/work/handoffs/docs-link-title-consistency.md`
