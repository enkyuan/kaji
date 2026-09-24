# docs/link-title-consistency

State: REVIEW
Branch: `docs/link-title-consistency`
Base SHA: `aaf7864ec4d7af7569ba36a8e3bed546281af3f5`
Worktree: `/Users/enkyuan/Desktop/Projects/kaji-wt/docs-link-title-consistency`

## Goal

One footer header and one title rule for every docs cross-reference: link titles must equal the target page's frontmatter title.

## Decisions

- Footer link-list sections use the single header `## Related guides`. It was already used by 2 of 3 pages (`architecture.mdx`, `cancellation.mdx`) and is accurate on the third.
- Every footer link title equals the target page's frontmatter `title`, which is the single source of truth rendered as the page H1.
- Sidebar labels in `apps/docs/src/data/navigation.ts` are links too, so they follow the same rule and moved to sentence case to match page titles.
- The root README's `## Timeout and cancellation` heading is descriptive prose about timeout behavior, not a link to `/docs/concepts/cancellation`; it stays unchanged and is byte-identical in both README copies per `readme:check`.

## Changed

- `apps/docs/content/getting-started.mdx`: `## Continue` → `## Related guides`; `Runnable refund example` → `Refund example`.
- `apps/docs/content/architecture.mdx`: `Timeout and cancellation` → `Cancellation`.
- `apps/docs/src/data/navigation.ts`: `Getting Started` → `Getting started`, `API Reference` → `API reference`, `Refund Example` → `Refund example`.
- `docs/work/active.md`: now records this task.

## Audit result (grep before edits)

All footer link lists in `apps/docs/content`: `getting-started.mdx`, `architecture.mdx`, `cancellation.mdx` — no others. Mismatches found: the two above plus three sidebar labels. Inline prose links (`Read [Outcomes](...)` and the `index.mdx` numbered start-here list) were audited; prose links already use exact page titles. The numbered list items are step descriptions, not titles, and were left unchanged.

## Verification

- `bun install --frozen-lockfile` — clean
- `bun run format:check` — pass
- `bun run lint` — pass
- `bun run readme:check` — pass
- `bun run typecheck` — pass (0 errors, 0 warnings)
- `bun run test` — pass (108/108)
- `bun run build` — pass (17 pages)
- Built `dist/` greps: zero occurrences of `Runnable refund example`, `Timeout and cancellation`, `Continue`; sidebar renders `Getting started`, `API reference`, `Refund example`; all three footers render `Related guides`.

## Remaining

None known. The branch is a single commit containing the fixes and this handoff.

## Next

Review the diff and merge `docs/link-title-consistency` into `main`; then remove the worktree and delete the branch per `AGENTS.md`.
