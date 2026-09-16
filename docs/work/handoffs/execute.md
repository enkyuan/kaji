# execute

State: DONE
Branch: feat/execute
Worktree: /Users/enkyuan/Desktop/Projects/kaji-wt/feat-execute
Owner: implementation
Base SHA: 4826777 (feat/execution-store)
Head SHA: c7dd445

## Goal

Implement Kaji's one canonical execution API — `createKaji()` and
`kaji.execute()` — composing the finalized `Capability` and
`ExecutionStore` contracts into the single deterministic path docs/api.md
freezes: validate, claim idempotency, authorize, obtain approval when
needed, execute, and record the explicit outcome.

## Decisions

- Exact execute signature: `Kaji.execute<Input, Result>(capability,
request: ExecutionRequest): Promise<ExecutionResult<Result>>`, matching
  docs/api.md's literal type exactly. There is no separate "options" shape
  — `ExecutionRequest` is the second parameter as frozen.
- Execution ordering: **validate → claim → authorize → approval → execute
  → settle**, matching docs/api.md's literal sentence ("validate, claim
  idempotency, authorize, obtain approval when needed, execute, and record
  the explicit outcome") rather than a validate-then-authorize-then-claim
  order. Claim happens before authorization because claiming an
  idempotency key is bookkeeping, not the side effect
  docs/invariants.md's "Authorization precedes side effects" protects.
  This lets a denied or rejected request still occupy and settle its
  idempotency key, so a retried denied request observes the same denial
  instead of racing a fresh authorization check against a duplicate claim.
- Approval semantics: `capability.approval` is a synchronous predicate
  seeing validated input; if it returns `true`, the executor calls the
  configured `approve` handler (`ApprovalRequest`/`ApprovalDecision`,
  internal types — docs/api.md keeps this shape inline in `createKaji()`'s
  options rather than naming it, so neither type is exported). A missing
  handler, an invalid decision shape, a rejected decision, or a
  thrown/rejected handler all resolve to `status: "rejected"`. Approval
  never runs before authorization; both run after the store claim.
- Cancellation semantics: the effective `AbortSignal` combines the
  caller's signal and the optional `timeoutMs` via native
  `AbortSignal.any()`/`AbortController` (no custom cancellation type).
  Before `capability.execute()` begins, an aborted signal produces
  `status: "cancelled"` and never claims/executes. Once `execute()` has
  begun, local cancellation cannot prove the side effect did not commit,
  so any non-`succeeded` outcome from that point on (thrown error, or the
  execute() promise never resolving before abort) settles
  `status: "unknown"`, never `"cancelled"` or `"failed"`.
- Timeout precedence: `timeoutMs` and a caller-supplied `signal` combine
  via `AbortSignal.any()` — whichever aborts first wins; there is no
  separate precedence rule because both are treated identically as inputs
  to one effective signal. A timeout before execution begins behaves
  exactly like a pre-execution cancellation (`"cancelled"`, no claim). A
  timeout after execution begins behaves exactly like a post-start
  cancellation (`"unknown"`).
- Unknown-outcome behavior: a thrown or rejected `capability.execute()`
  call always settles `"unknown"`, never `"failed"` — matching docs/api.md
  exactly ("Kaji treats a thrown or rejected execute call as unknown").
  There is no separate `unknownOutcome()` export; docs/api.md's frozen
  export boundary does not list one, and application code has no way to
  signal "unknown" itself in v0 — only Kaji's own classification of
  execute()'s outcome produces `"unknown"`.
- Settlement acknowledgement semantics: a `store.claim()` failure (before
  any execution record exists) is a boundary failure — it throws
  `KajiConfigurationError`, matching docs/api.md's "may reject only when
  Kaji cannot establish the execution boundary... an unrecoverable store
  error before an execution record exists." A `store.record()`
  (settlement) failure occurring AFTER a real capability outcome is
  different: the side effect may have already happened, so silently
  returning the real `"succeeded"` result would claim durable
  acknowledgement Kaji does not have. That case settles/returns
  `status: "unknown"` with the settlement failure as `error`, preserving
  docs/invariants.md's "Ambiguous outcomes are preserved." This was a real
  ambiguity in the frozen docs (which do not explicitly state this case);
  resolving it as `unknown` rather than throwing was chosen because
  invariants.md is unambiguous that persistence uncertainty must not
  become ordinary success, and `unknown` is the existing safe vocabulary
  for exactly that ambiguity — this did not require inventing new
  semantics.
- Idempotency-conflict semantics: reuse of an idempotency key with a
  different input fingerprint returns `status: "failed"` (not a distinct
  status, not a thrown error), matching docs/api.md exactly ("must return
  a conflict as a `failed` result").
- Running-duplicate semantics: a concurrent or retried call for the same
  identity `await`s the existing claim's `outcome` promise and returns
  that resolved value directly — it does not poll, does not retry, and
  does not run `capability.execute()` again. This matches docs/api.md
  exactly ("A concurrent duplicate waits for or receives the same
  recorded outcome; it must not run `execute` again").
- Execution ID ownership: `memoryStore()` (from `feat/execution-store`)
  generates `executionId` inside `claim()`. The executor never generates
  its own ID and never generates one in a second place.
- Error taxonomy: no `KajiError`/`KajiErrorCode` class hierarchy was
  added. docs/api.md is explicit that `execute()` "does not throw for
  expected execution outcomes" — every expected outcome (denied, rejected,
  failed, cancelled, unknown) is a `status` value on the returned
  `ExecutionResult`, not a thrown typed error. The only thrown type is
  `KajiConfigurationError`, used exclusively for the boundary failures
  docs/api.md names (invalid request metadata before any claim exists,
  and unrecoverable `store.claim()` failure before a record exists).
- Root export list: `capability`, `createKaji`, `memoryStore` (values) and
  `Capability`, `ExecutionContext`, `ExecutionEvidence`, `ExecutionRequest`,
  `ExecutionResult`, `ExecutionStore` (types) — matching docs/api.md's
  "Export boundary" section exactly. `ExecutionClaim`, `ClaimResult`, and
  `StoredExecution` remain exported per `feat/execution-store`'s
  documented interpretation (no subpath entry point exists in this
  repository). `Kaji` and `KajiOptions` are deliberately NOT exported,
  even though `createKaji(): Kaji` is a value export — docs/api.md's
  literal export list does not include either type name. This may be an
  oversight in the frozen doc (a consumer cannot name a `Kaji`-typed
  variable before calling `createKaji()` without `ReturnType<typeof
createKaji>`), but per authority order this branch follows the literal
  list rather than silently widening the public surface.
- No dependency added. Runtime dependency count remains zero. Cancellation
  and timeout use only native `AbortSignal`/`AbortController`.

## Changed

- packages/ts/src/capability.ts: adds `capabilityDefinition()`, an
  internal (not index-exported) accessor that recovers the full
  declaration from a `Capability` instance for the executor to read.
  `CapabilityDefinition` is now exported at module scope (still not
  root-exported) so `execute.ts` can reference its type.
- packages/ts/src/execution-request.ts: new. `ExecutionRequest`
  (root-exported).
- packages/ts/src/approval.ts: new. Internal `ApprovalRequest`,
  `ApprovalDecision`, `ApproveHandler`, and `resolveApproval()`.
- packages/ts/src/effective-signal.ts: new. Internal `effectiveSignal()`
  combining a caller signal and `timeoutMs` into one `AbortSignal` via
  native primitives, with deterministic timer cleanup.
- packages/ts/src/errors.ts: new. `KajiConfigurationError` (internal —
  not root-exported; docs/api.md does not name a public error type).
- packages/ts/src/execute.ts: new. `executeCapability()`, the one
  canonical execution path, and its internal helpers (`runCapability`,
  `claim`, `settle`, `guarded`, result constructors).
- packages/ts/src/kaji.ts: new. `createKaji()`, `Kaji` (module-scoped, not
  root-exported per the decision above), `KajiOptions` (same).
- packages/ts/src/index.ts: adds `createKaji` to the value export list;
  type export list unchanged from `feat/execution-store` except this
  branch does not add `Kaji`/`KajiOptions`.
- packages/ts/tests/execute-happy-path.test.ts,
  execute-preflight.test.ts, execute-replay.test.ts,
  execute-cancellation.test.ts, execute-unknown-and-order.test.ts,
  execute.type-test.ts: new. Cover the happy path, pre-execution gates,
  replay/duplicate/conflict/unknown-existing behavior, cancellation and
  timeout (via `vi.useFakeTimers`), store-failure handling, observable
  pipeline order, and compile-time type contracts.
- packages/ts/tests/package.test.ts: updated root export assertion to
  include `createKaji`.
- packages/ts/scripts/smoke-package.ts: packed-artifact smoke test now
  also constructs a `createKaji()` executor and performs one real
  `kaji.execute()` call end to end.
- docs/work/active.md, docs/work/handoffs/execute.md: this handoff.

## Invariants

- "One execution path": `executeCapability()` is the only function that
  calls `capability.execute()`; there is no second entry point.
- "Application owns domain logic": the executor never inspects or
  transforms `execute`'s return value beyond wrapping it in
  `ExecutionResult`.
- "Principal is explicit": `principalId`/`idempotencyKey` are required,
  non-empty, caller-supplied strings validated before any claim; never
  inferred from process state.
- "Validation precedes execution": invalid input throws inside
  `validateInput()` before claim, authorize, approval, or execute run —
  tested explicitly.
- "Authorization precedes side effects": authorization always resolves
  before `capability.execute()`, even though it resolves after the store
  claim (claim is not a side effect).
- "Approval is fail-closed": missing handler, invalid decision, rejection,
  or handler failure all prevent execution — tested.
- "Idempotency is explicit": conflicting fingerprint reuse returns
  `status: "failed"` without executing — tested.
- "Duplicate execution is prevented": concurrent/retried identical
  requests await the same outcome and never call `execute()` a second
  time — tested with 25 concurrent calls.
- "Ambiguous outcomes are preserved": thrown/rejected `execute()`, mid-
  flight cancellation/timeout, and post-success settlement failure all
  settle `"unknown"`, never `"failed"` — tested for each case.
- "Cancellation is cooperative" / "Timeout is not rollback": both use one
  combined native `AbortSignal`; neither implies rollback of a possibly
  committed effect.
- "Framework neutrality" / "Small public surface" / "Native primitives
  first": no agent/model/database dependency; zero runtime dependencies;
  `AbortSignal.any()`/`AbortController` only.

## Verification

Run from packages/ts and from repo root; all passed:

- `bun install --frozen-lockfile`: passed.
- `bun --filter=@irogane/kaji run format:check`: passed.
- `bun --filter=@irogane/kaji run lint`: passed, 0 warnings/0 errors.
- `bun --filter=@irogane/kaji run typecheck`: passed.
- `bun --filter=@irogane/kaji run test`: passed, 78/78 tests across 11
  files.
- `bun --filter=@irogane/kaji run build`: passed; inspected
  `dist/index.d.mts` manually — readable, exported surface matches
  docs/api.md's export boundary exactly.
- `bun --filter=@irogane/kaji run package:check`: passed (publint + attw
  esm-only profile).
- `bun --filter=@irogane/kaji run package:smoke`: passed (packed tarball
  installs, imports, and exercises a real end-to-end
  `createKaji().execute()` call).
- Root-scoped `bun run format:check`, `bun run lint`, `bun run typecheck`,
  `bun run test`: all passed across both workspaces.
- Independent adversarial review: verified the execute signature, exact
  `ExecutionResult` shape (no extra `replayed`/`outcome`/`value` fields),
  claim-before-authorize ordering against the literal docs/api.md
  sentence, awaited-not-polled running-duplicate behavior, conflict as
  `failed`, unknown classification for thrown/rejected/mid-flight-aborted
  execute() calls, claim-failure-throws vs. settlement-failure-becomes-
  unknown boundary handling, exact root export list (including the
  deliberate absence of `Kaji`/`KajiOptions`), absence of a duplicate
  execution path or automatic retry, zero runtime dependencies, readable
  generated declarations, and deterministic concurrency/cancellation
  tests (fake timers and promise gates, no arbitrary sleeps). Found one
  MINOR note (debatable throw-vs-return classification for empty request
  metadata) and no CRITICAL or MODERATE findings. Verdict: APPROVE WITH
  MINOR NOTES.

## Remaining

- Automatic retries are NOT implemented — the executor never reruns,
  schedules, or reconciles anything; retries are entirely a caller
  concern using the store's claim/replay contract.
- A production/durable database backend is NOT implemented;
  `memoryStore()` remains the only v0 store, process-local only.
- Agent/model/framework adapters are NOT implemented; nothing in this
  branch depends on any agent SDK, model provider, or MCP concept.
- The `Kaji`/`KajiOptions` export-omission noted above is a literal
  reading of docs/api.md's export list, which may be an unintentional gap
  in that document (a consumer cannot name the executor's type without
  `ReturnType<typeof createKaji>`). If this is confirmed unintentional, a
  documentation-only follow-up should add both type names to docs/api.md
  and this package's exports.
- The empty-request-field-throws classification (MINOR review note) could
  alternatively be modeled as a `status: "failed"` result instead of a
  thrown `KajiConfigurationError`, if a future task decides invalid
  request metadata should be caller-recoverable data rather than a
  configuration-class failure. Not changed here since docs/api.md's
  "reject only for... invalid executor configuration" language supports
  the current choice.

## Next

test/failure-semantics
