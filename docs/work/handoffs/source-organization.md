# refactor/source-organization

Branch: refactor/source-organization
Base SHA: origin/main at task start (538267b → see merge record)
Head SHA: 934c27b

## Goal

Make the TypeScript source tree communicate Kaji's product responsibilities
and codify those rules for contributors.

## Decisions

- Root public concepts remain flat: capability.ts, schema.ts, kaji.ts,
  errors.ts, index.ts
- execution/ owns execution orchestration (approval, context, execute,
  request, result, signal)
- store/ owns claim/settlement persistence semantics (store, memory,
  fingerprint)
- src/index.ts is the only barrel; no nested barrels
- types stay beside owning concepts (store/store.ts imports the
  ExecutionResult TYPE from execution/result.ts — type-only, frozen by the
  StoredExecution contract; no runtime dependency)
- kaji.ts was inspected and is already a pure delegation boundary; no
  pipeline consolidation was needed
- no generic architectural directories
- tests stay behavior-organized (existing names already match the contract:
  happy-path/replay/cancellation/concurrency/failures + capability/schema/
  store/type tests); only import paths changed

## Changed

- 9 moves: approval→execution/approval, effective-signal→execution/signal,
  execute→execution/execute, execution-context→execution/context,
  execution-request→execution/request, execution-result→execution/result,
  execution-store→store/store, memory-store→store/memory,
  fingerprint→store/fingerprint
- import-path updates in src and tests only
- AGENTS.md: new "Source organization" section (root files, responsibility
  directories, filenames, types, barrels, dependency direction, tests) +
  reconciled the "Naming and filesystem semantics" example file list (no
  contradictory layout rules remain)

## Verification

- bun install --frozen-lockfile: OK
- format:check, lint, typecheck, build: PASS (all workspaces)
- vitest: 88/88 passed
- package:check (publint + attw esm-only): PASS
- package:smoke: PASS
- example:refund: PASS
- Public API snapshot: declaration export line identical before/after; only
  .d.mts diff is `//#region` source-path comments (harmless tooling paths)
- Independent structural review (fusion, clean read-only contexts):
  APPROVE-WITH-NITS; the single nit (duplicated AGENTS.md paragraph) was
  fixed before commit. All 8 concerns PASS: layout complete, imports resolve
  (zero stale references), frozen API unchanged (enforced by
  tests/package.test.ts), no algorithmic edits (byte-identical files except
  import specifiers), consumers use the bare root specifier only,
  build/tooling config untouched, module graph acyclic and matching the new
  dependency rules.

## Public API changed

No.

## Behavior changed

No.

## Remaining

None for this task. Note for future contributors: tests must run through
`bun run test` (vitest); `bun test` (bun's runner) lacks
`vi.advanceTimersByTimeAsync` and reports 2 false failures.

## Next

Continue release/docs work according to the current project plan
(docs/install-tabs branch ships the tabbed install UI).
