# capability-api

State: DONE
Branch: feat/capability-api
Worktree: /Users/enkyuan/Desktop/Projects/kaji-wt/feat-capability-api
Owner: implementation
Base SHA: 30239fd (build/ts-package)
Head SHA: pending commit on feat/capability-api

## Goal

Implement Kaji's minimal capability declaration and validator-neutral input
parser contract: the smallest useful abstraction for declaring an
application action that Kaji can later execute safely. This branch defines
the capability; it does not execute it.

## Decisions

- Capability representation: a plain frozen object returned by the single
  canonical constructor `capability()`. No class, builder, or registry.
- Input contract: matches docs/api.md's literal signature exactly —
  `input: { parse(input: unknown): Input }`. An earlier draft of this
  implementation used the Standard Schema v1 `~standard` protocol instead;
  an adversarial review correctly identified this as a material conflict
  with the frozen contract (docs/api.md's literal type and the DONE
  product-contract handoff's decision that "a capability uses a structural
  parser contract instead of a Kaji schema abstraction"). The
  implementation was corrected to the frozen `{ parse }` shape. This means
  async validation and structured multi-issue validation are NOT supported
  in v0 — a schema's `parse()` must be synchronous and throw on failure.
  Libraries with async-only validation, or that want structured issue
  arrays preserved, are not compatible with today's frozen signature.
- `authorize` is required (not optional), matching docs/api.md exactly.
  `capability()` throws if it is missing.
- `approval` is optional and synchronous-only (`=> boolean`), matching
  docs/api.md exactly. It is not `Promise<boolean>`.
- Callback input semantics: `authorize`, `approval`, and `execute` all
  receive the parser's returned/validated type, inferred without explicit
  generics from the shape of `definition.input.parse`.
- Timeout representation: none. docs/api.md does not define a
  capability-level timeout; `timeoutMs` exists only on the future
  `createKaji()` executor. No timeout field was added here.
- Immutability: `capability()` returns `Object.freeze()`d object. `name` is
  readonly and cannot be reassigned (throws `TypeError` in strict mode/ESM).
  Application schemas and functions passed in are not cloned or frozen.
- Public type surface: only `capability`, `Capability`, and
  `ExecutionContext` are exported from the package root, matching the
  frozen export boundary. `CapabilityDefinition`, `InputParser`, and
  `validateInput` stay internal (not exported from index.ts).
  `Capability<Input, Result>` intentionally exposes only `name`; the
  runtime object carries `input`/`authorize`/`approval`/`execute` for a
  future executor to read, but the public type does not advertise them.
- No dependency added. Runtime dependency count remains zero.
- Added `packages/ts/.oxlintrc.json` with one scoped override: disables
  `no-unused-vars` for `src/capability.ts` only, because
  `Capability<Input, Result>` intentionally keeps unused type parameters to
  match docs/api.md's literal generic signature (a future `Kaji.execute()`
  needs them to recover both types).
- Broadened `packages/ts/tsconfig.json` to also typecheck `tests/**/*.ts`
  (previously `src/**/*.ts` only) and added
  `allowImportingTsExtensions: true`, since `tsc --noEmit` otherwise
  rejects the `.ts` extension in relative imports that bun/vitest require
  at runtime. This is the only tsconfig change.

## Changed

- packages/ts/src/capability.ts: `capability()`, `Capability`,
  `CapabilityDefinition` (internal), `PrincipalRequest` (internal).
- packages/ts/src/schema.ts: `InputParser` (internal), `validateInput()`
  (internal) — the one canonical validation primitive.
- packages/ts/src/execution-context.ts: `ExecutionContext`.
- packages/ts/src/index.ts: exports `capability`, `Capability`,
  `ExecutionContext`.
- packages/ts/tests/capability.test.ts: runtime capability contract tests.
- packages/ts/tests/schema.test.ts: `validateInput()` contract tests.
- packages/ts/tests/capability.type-test.ts: compile-time type contract
  tests (inference, `@ts-expect-error` cases). Checked by `tsc`, not run by
  vitest.
- packages/ts/tests/package.test.ts: updated to assert the real root export
  list instead of the scaffold's empty-export assertion.
- packages/ts/scripts/smoke-package.ts: updated the packed-artifact smoke
  test to construct and typecheck a real `capability()` call instead of a
  side-effect-only import.
- packages/ts/tsconfig.json: added `tests/**/*.ts` to `include` and
  `allowImportingTsExtensions: true`.
- packages/ts/.oxlintrc.json: new, scoped `no-unused-vars` override for
  `src/capability.ts`.
- docs/work/active.md, docs/work/handoffs/capability-api.md: this handoff.

## Invariants

- "Application owns domain logic": `execute` remains ordinary application
  code; capability() never inspects or transforms it.
- "Principal is explicit": identity is exactly `principalId: string` on
  `PrincipalRequest` and `ExecutionContext`; never inferred from process
  state.
- "Validation precedes execution": `validateInput()` is the one canonical
  validation primitive; there is no second path. (Not yet wired to an
  executor — that is `feat/execute`'s job.)
- "Framework neutrality": no agent/model/framework type or dependency
  anywhere in source.
- "Small public surface": 3 root exports only.
- "Native primitives first": `ExecutionContext.signal` is a native
  `AbortSignal`; no custom cancellation token.
- "One execution path": not yet applicable — no execution path exists in
  this branch by design.

## Verification

Run from packages/ts and from repo root; all passed:

- `bun install --frozen-lockfile`: passed.
- `bun --filter=@irogane/kaji run format:check`: passed.
- `bun --filter=@irogane/kaji run lint`: passed, 0 warnings/0 errors.
- `bun --filter=@irogane/kaji run typecheck`: passed (covers src and tests,
  including the type-contract test file).
- `bun --filter=@irogane/kaji run test`: passed, 11/11 tests across 3 files.
- `bun --filter=@irogane/kaji run build`: passed; inspected
  `dist/index.d.mts` manually — readable, doc comments preserved, exports
  exactly `capability`, `Capability`, `ExecutionContext`.
- `bun --filter=@irogane/kaji run package:check`: passed (publint + attw
  esm-only profile).
- `bun --filter=@irogane/kaji run package:smoke`: passed (packed tarball
  installs, imports, and typechecks a real `capability()` call).
- Root-scoped `bun run format:check`, `bun run lint`, `bun run typecheck`,
  `bun run test`: all passed across both workspaces.
- Independent adversarial review (first pass): found one CRITICAL
  (Standard Schema deviation from frozen `{ parse }` contract) and two
  MODERATE findings (authorize wrongly optional; approval wrongly async).
  Verdict: RETURN TO SCOPED.
- Implementation corrected to the frozen contract exactly.
- Independent adversarial review (second pass): confirmed all three
  findings fixed by re-reading the corrected diff and re-running checks;
  found one minor cosmetic issue (a redundant, ineffective inline
  suppression comment alongside the working `.oxlintrc.json` override),
  which was removed. Verdict: APPROVE WITH MINOR NOTES.

## Remaining

- Async validation and structured multi-issue validation are not supported
  by the frozen `{ parse(input: unknown): Input }` contract. If a future
  need for async schemas or structured issues is demonstrated, that
  requires a deliberate product decision to amend docs/api.md before any
  implementation changes — not a decision for an implementation branch to
  make unilaterally. This was the exact mistake caught by adversarial
  review in this task and corrected.
- No known implementation debt within the frozen contract as written.

## Next

feat/execution-store
