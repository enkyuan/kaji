# Active work

Task: `docs/editorial-review`

- State: `DONE`
- Owner: implementation
- Branch: `docs/editorial-review`
- Worktree: `/Users/enkyuan/Desktop/Projects/kaji-wt/consolidate-main`
- Base SHA: `21b40c3fd51d4ddb7ebc97e00ae26691f19b96d5` (rebased onto `origin/main` at `7b8e6ec`, then merged with `refactor/standard-schema` at reconciliation; see below)
- Goal: Make the root README canonical and rewrite every public documentation page for accuracy, clarity, and scanability.
- Package source diff: none allowed
- Public API diff: none allowed

## Corrected result model

The public result statuses are `succeeded`, `denied`, `rejected`, `failed`, `cancelled`, and `unknown`.

`knownFailure()` is one path to `failed`. An idempotency conflict also returns `failed`.

`unknown` means that Kaji cannot prove whether the side effect committed. The documentation must not introduce `COMPLETED` or a parallel three-state model.

## Scope

- Rewrite the root README and keep `packages/ts/README.md` byte-identical.
- Add a deterministic README drift check.
- Review and rewrite every public prose surface under `apps/docs`.
- Add focused pages for authorization, outcomes, stores, the API reference, and the refund example.
- Preserve the current visual system unless presentation blocks comprehension.
- Fix broken documentation links found during the review.
- Run technical, editorial, rendered-page, package, and repository verification.

## Exact verification commands

- `bun install --frozen-lockfile`
- `bun run format:check`
- `bun run lint`
- `bun run typecheck`
- `bun run test`
- `bun run build`
- `bun run package:check`
- `bun run package:smoke`
- `bun run example:refund`
- `npm pack --dry-run --workspace packages/ts`

## Progress

- Confirmed the live npm package is `@irogane/kaji@0.3.1`.
- Confirmed the branch and clean base before edits.
- Read `AGENTS.md`, the work history, release handoffs, package exports, generated declarations, public API contract, invariants, decisions, README files, and all public documentation pages.
- Completed the clean baseline. All configured checks passed. The test suite reported 88 passing tests.
- Confirmed that the repository has no coverage command.
- Rewrote the canonical root README and synchronized the package README.
- Added the README drift check and package-workflow coverage.
- Rewrote the start pages and the core pages for capabilities, authorization, execution, approval, outcomes, idempotency, and stores.
- Corrected the API contract to define execution identity as capability, principal ID, and idempotency key.
- Found a documentation-contract defect in the timeout wording. The shipped package aborts `context.signal` but continues awaiting `execute()`.
- Corrected the API contract, invariants, README, and execution guidance to describe cooperative timeout behavior.
- Found that `approve()` accepts evidence but Kaji does not expose or persist it.
- Corrected approval documentation so application approval systems retain required audit evidence.
- Confirmed F5: a thrown capability `approval()` predicate leaves its post-claim execution unsettled.
- Kept F5 out of the public contract and reserved it for a separate runtime task before the next package release.

## Remaining

1. Open a separate `fix/` task for the F5 unsettled-claim defect (thrown `approval()` predicate leaves the execution claim unsettled) with a failing regression test, before the next package release.
2. Optional follow-up outside this task's scope: align `docs/product.md`'s one-sentence definition with the unhedged, mechanism-first language used in the corrected public surfaces.
3. Make the release/versioning decision for the Standard Schema input-contract break (recorded in `docs/work/handoffs/standard-schema.md`) before publishing a new package version.

Independent adversarial review completed via subagent; all material findings resolved (fixed or reviewed-and-retained with justification). See `docs/work/handoffs/docs-editorial-review.md` for the full disposition.

## Reconciliation with origin/main and refactor/standard-schema

Rebased onto `origin/main` at `7b8e6ec` (PR #26's homepage install/codeblock change) with zero conflicts. Merged `refactor/standard-schema` (PR #25, edef94b/6d3bca8) so `capability()`'s input contract source of truth is Standard Schema V1. Rewrote every `.parse(input)`-contract claim across README.md, packages/ts/README.md, docs/api.md, and the affected apps/docs pages (getting-started, concepts/capability, concepts/executor, concepts/outcomes, reference/api, troubleshooting) to describe `~standard`/`validate()`/`SchemaOutput`/`InvalidInputError`. Full detail in `docs/work/handoffs/docs-editorial-review.md`'s "Reconciliation" section.

Test suite now reports 108 passing tests (was 88; +19 from the merged Standard Schema protocol/inference/interop coverage). All other verification commands re-run and pass. Task remains `DONE`; ready to commit and merge.
