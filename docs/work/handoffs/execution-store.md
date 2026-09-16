# execution-store

State: DONE
Branch: feat/execution-store
Worktree: /Users/enkyuan/Desktop/Projects/kaji-wt/feat-execution-store
Owner: implementation
Base SHA: 7398d61 (feat/capability-api)
Head SHA: pending commit on feat/execution-store

## Goal

Implement Kaji's minimal atomic execution-store contract and in-memory
reference implementation: the smallest store abstraction capable of making
Kaji execution safe under retries, duplicate requests, concurrent duplicate
requests, conflicting idempotency key reuse, completed-result replay, and
ambiguous/unknown outcomes. This branch implements only the store side of
`claim → execute → record`; it does not execute capabilities.

## Decisions

- Execution identity tuple: `capability` + `principalId` + `idempotencyKey`,
  matching docs/api.md's `ExecutionClaim` exactly. Conflicting reuse of that
  tuple is detected by comparing `inputFingerprint`, not by hashing
  `principalId` into the fingerprint itself.
- Claim-state model: exactly the three states frozen by docs/api.md —
  `claimed`, `existing`, `conflict`. There are no separate `running`,
  `completed`, or `unknown` claim states. `existing.outcome` is a
  `Promise<StoredExecution>` that resolves once `record()` settles the
  execution; a caller distinguishes running-vs-settled by whether that
  promise has resolved yet, and distinguishes completed-vs-unknown by the
  resolved value's `status`. This is a deliberate design in docs/api.md,
  not a simplification introduced here.
- Settlement semantics: `record(execution: StoredExecution)` settles a
  previously claimed execution exactly once. A second `record()` call for
  the same `executionId` throws — it never silently overwrites a terminal
  outcome (e.g. `unknown` → `succeeded`). `record()` for an
  `executionId` that was never claimed (or whose identity does not match
  the stored claim) also throws. These are store misuse errors, not
  ordinary execution outcomes, so they throw rather than returning a
  `ClaimResult` variant.
- Unknown-outcome behavior: `unknown` is stored and replayed exactly like
  `succeeded`/`failed` — through `existing.outcome`. A later claim for the
  same identity never receives `"claimed"` again once any terminal outcome
  (including `unknown`) is recorded; it always receives `"existing"`. There
  is no reconciliation, retry, or automatic promotion out of `unknown`.
- Conflict semantics: same identity tuple with a different
  `inputFingerprint` returns `{ status: "conflict", executionId }`
  immediately; it does not wait on or affect the original claim's outcome.
- Fingerprint strategy: `fingerprintInput(capability, input)` in
  `fingerprint.ts` canonicalizes a JSON-shaped value by sorting object keys
  before serializing (so key insertion order cannot change the result),
  preserves array order, and preserves primitive type distinctions. It
  rejects non-finite numbers, `undefined`, functions, and other values
  outside the JSON-shaped domain by throwing `UnfingerprintableValueError`
  rather than serializing them unpredictably. No hashing library or
  platform hash primitive is used — equality comparison of the canonical
  string is sufficient for v0's needs, so hashing would add a dependency
  or platform-primitive call with no behavioral benefit.
- Supported durable value boundary: plain JSON-shaped data only (string,
  number, boolean, null, array, plain object). This matches capability
  input being schema-validated application data; it excludes functions,
  symbols, and other values a schema parser would not normally produce.
- Known failures ARE persisted: `StoredExecution = ExecutionResult<unknown>`
  includes the `denied | rejected | failed | cancelled` status group, and
  the store treats all of them identically to `succeeded`/`unknown` for
  claim/replay purposes — this is what docs/api.md's frozen `StoredExecution`
  type requires, not an addition made in this task.
- Scope note: `fingerprintInput()` is not yet called by anything in this
  branch (no executor exists to call it) and is not exported from
  `index.ts`. It is included now because `ExecutionClaim.inputFingerprint`
  is a required field the store's contract already depends on, and
  `feat/execute` will need a canonical fingerprint function when it starts
  computing that field from validated capability input. Keeping it
  internal avoids widening the public surface before a real caller exists.
- Export-boundary interpretation (deviation from docs/api.md's literal
  text, documented here rather than silently applied): docs/api.md's
  "Export boundary" section states `ExecutionClaim`, `ClaimResult`, and
  `StoredExecution` are "exported only from the store entry point,"
  distinct from `ExecutionResult`/`ExecutionEvidence`/`ExecutionStore`,
  which it lists as root-exported. This repository has no subpath export
  infrastructure (`packages/ts/package.json`'s `exports` map has only
  `"."`), and adding one was out of this task's scope (no package-export
  or build-tooling change was requested). All six type names are exported
  from the single root `index.ts` in this branch. This does not leak any
  internal implementation type — every exported name is one docs/api.md
  already designates as public — but it does not reproduce docs/api.md's
  entry-point split. If a future task adds a `./store` subpath (or the
  product decision is that v0 does not need the split), this decision
  should be revisited and docs/api.md reconciled explicitly rather than
  left inconsistent with the shipped code.

## Changed

- packages/ts/src/execution-result.ts: `ExecutionResult<Result>`,
  `ExecutionEvidence` (both root-exported; needed because
  `StoredExecution = ExecutionResult<unknown>`).
- packages/ts/src/execution-store.ts: `ExecutionClaim`, `StoredExecution`,
  `ClaimResult`, `ExecutionStore`.
- packages/ts/src/memory-store.ts: `memoryStore()`, the process-local
  reference `ExecutionStore`. Internal `ClaimedExecution`/`identityKey`.
- packages/ts/src/fingerprint.ts: `fingerprintInput()` (internal),
  `UnfingerprintableValueError` (internal).
- packages/ts/src/index.ts: adds `memoryStore` and the store/result types
  to the root export list (see export-boundary decision above).
- packages/ts/tests/execution-store.test.ts: interface-implementability and
  discriminated-union type-contract tests.
- packages/ts/tests/memory-store.test.ts: claim semantics (first claim,
  running duplicate, 20-way concurrent claim, conflict, key/capability/
  principal isolation) and settlement semantics (succeeded/unknown
  resolution, replay, blind-reclaim prevention, unclaimed/double-settle
  rejection).
- packages/ts/tests/fingerprint.test.ts: determinism, key-order
  independence, array order, primitive-type distinction, unsupported-value
  rejection.
- packages/ts/tests/package.test.ts: updated root export assertion to
  include `memoryStore`.
- packages/ts/scripts/smoke-package.ts: packed-artifact smoke test now
  also constructs a `memoryStore()` and performs one real `claim()` call.
- docs/work/active.md, docs/work/handoffs/execution-store.md: this
  handoff.

## Invariants

- "Idempotency is explicit": same identity + different fingerprint returns
  `conflict`, never silently succeeds. Tested.
- "Duplicate execution is prevented": exactly one concurrent identical
  claim receives `"claimed"`; all others receive `"existing"`. Tested with
  20 concurrent calls.
- "Ambiguous outcomes are preserved": `unknown` is stored and replayed
  distinctly from `succeeded`/`failed`; it is never reclaimed for blind
  execution. Tested.
- "Evidence is minimal": `ExecutionEvidence` carries only
  `executionId`/`capability`/`principalId`/`idempotencyKey`/
  `inputFingerprint` — no timestamps, traces, or event history.
- "Store semantics are atomic where required": `claim()`'s
  check-then-create has no `await` between reading and writing map state,
  so no async gap exists for a second caller to observe the same identity
  as absent.
- "Framework neutrality" / "Small public surface": no agent/model/database
  type anywhere; the store imports no capability execution behavior
  (`authorize`/`approval`/`execute`/`validateInput` are never called).
- "Native primitives first": `crypto.randomUUID()` is a platform primitive,
  not a UUID dependency.

## Verification

Run from packages/ts and from repo root; all passed:

- `bun install --frozen-lockfile`: passed.
- `bun --filter=@irogane/kaji run format:check`: passed.
- `bun --filter=@irogane/kaji run lint`: passed, 0 warnings/0 errors.
- `bun --filter=@irogane/kaji run typecheck`: passed.
- `bun --filter=@irogane/kaji run test`: passed, 35/35 tests across 6 files.
- `bun --filter=@irogane/kaji run build`: passed; inspected
  `dist/index.d.mts` manually — readable, discriminated unions render
  clearly, doc comments preserved.
- `bun --filter=@irogane/kaji run package:check`: passed (publint + attw
  esm-only profile).
- `bun --filter=@irogane/kaji run package:smoke`: passed (packed tarball
  installs, imports, and exercises a real `memoryStore().claim()` call).
- Root-scoped `bun run format:check`, `bun run lint`, `bun run typecheck`,
  `bun run test`: all passed across both workspaces.
- Independent adversarial review: verified type-shape fidelity to
  docs/api.md, absence of extra claim states/fields, no async gap in
  `claim()`'s critical section, correct conflict/unknown/replay/terminal-
  overwrite behavior, deterministic key-order-independent fingerprinting,
  no capability-execution coupling, zero runtime dependencies, and readable
  generated declarations. Found two MODERATE process gaps (undocumented
  export-boundary deviation; missing handoff) and one MINOR scope note
  (fingerprint.ts has no caller yet within this branch) — no CRITICAL
  findings. Verdict: APPROVE WITH MINOR NOTES. Both MODERATE findings are
  resolved by this handoff; the MINOR finding is addressed by the "Scope
  note" decision above.

## Remaining

- Capability execution is NOT implemented in this branch.
- Authorization enforcement is NOT implemented in this branch.
- Approval enforcement is NOT implemented in this branch.
- Retries are NOT implemented in this branch — the store only reports
  state; it never reruns, schedules, or reconciles anything automatically.
- Production/durable persistence is NOT implemented in this branch;
  `memoryStore()` is process-local only, with no cross-process visibility
  and no durability guarantee.
- The export-boundary deviation documented above (all store types
  root-exported instead of split into a separate store entry point) should
  be reconciled with docs/api.md's literal text if a future task adds
  subpath export infrastructure, or docs/api.md should be updated to match
  the shipped root-export shape as a deliberate product decision.
- `fingerprintInput()` exists but has no caller yet; `feat/execute` is
  expected to call it when computing `inputFingerprint` from validated
  capability input before calling `store.claim()`.

## Next

feat/execute
