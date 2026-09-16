# ts-package

State: DONE
Branch: build/ts-package
Worktree: /Users/enkyuan/Desktop/Projects/kaji
Owner: implementation
Base SHA: 437cfdab50094096f8df1844b7e1d7e36863dbd5
Head SHA: 437cfdab50094096f8df1844b7e1d7e36863dbd5

## Goal

Create the production-quality TypeScript package scaffold for @irogane/kaji with no product logic.

## Decisions

- The root entrypoint is intentionally `export {}`. No Kaji product API is scaffolded.
- The package publishes ESM and TypeScript declarations only. No repository compatibility target requires CommonJS.
- `attw` uses its `esm-only` profile to validate the declared package target.
- The smoke test consumes the actual `npm pack` tarball in a temporary consumer, imports it, typechecks it, and rejects source, test, script, and config files in the artifact.
- Runtime dependency count is zero. All tooling dependencies are development dependencies.

## Changed

- package.json: Added packages workspace support and thin package commands.
- bun.lock: Pinned TypeScript package tooling dependencies.
- packages/ts/package.json: Added publish metadata, scripts, ESM root export, and development tooling.
- packages/ts/tsconfig.json: Added strict no-emit TypeScript checking for source files.
- packages/ts/tsdown.config.ts: Added ESM and declaration build configuration.
- packages/ts/src/index.ts: Added the intentionally empty root entrypoint.
- packages/ts/tests/package.test.ts: Added root entry import coverage.
- packages/ts/scripts/smoke-package.ts: Added packed-artifact installation, ESM import, declaration typecheck, and package-content checks.
- .github/workflows/typescript-package.yml: Added clean-checkout package verification.
- docs/work/active.md: Recorded the completed package scaffold objective.
- docs/work/handoffs/ts-package.md: Recorded this handoff.

## Invariants

- No product behavior, agent framework integration, provider dependency, session state, workflow behavior, or event-sourcing concept is implemented.
- The package root has no public product exports.
- The packed artifact is the consumer test subject.

## Verification

- `bun install --frozen-lockfile`: passed.
- `bun run format:check`: passed.
- `bun run lint`: passed.
- `bun run typecheck`: passed.
- `bun run test`: passed.
- `bun run build`: passed.
- `bun run package:check`: passed with publint and attw ESM validation.
- `bun run package:smoke`: passed with `npm pack`, temporary installation, ESM import, and consumer typecheck.
- Independent adversarial review: no material finding remained.

## Remaining

- No known debt.

## Next

feat/capability-api
