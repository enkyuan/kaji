# failure-semantics

State: DONE
Branch: test/failure-semantics
Worktree: /Users/enkyuan/Desktop/Projects/kaji-wt/test-failure-semantics
Owner: verification
Base SHA: 61cd1fa (feat/execute)
Head SHA: a5f2b0c

## Goal

Prove Kaji preserves its core safety property — "Kaji must never turn
uncertainty into permission to execute again" — under realistic failure,
ambiguity, duplication, cancellation, timeout, and concurrency. This is a
hardening branch: it adds no product behavior and changes no file under
`packages/ts/src`.

## Decisions

- Ambiguous-side-effect test model: `ambiguousGateway()` (local to
  `execution-replay.test.ts`) simulates a refund provider that commits its
  effect and then loses the acknowledgement (connection failure after
  commit), mirroring docs/product.md's canonical ambiguous-outcome
  example. It asserts the side effect committed exactly once
  (`gateway.committed()`), that Kaji surfaces `unknown` (not `failed`),
  and that a retried request with the same idempotency key never
  re-invokes the capability.
- Cancellation boundary: every stage before `capability.execute()` begins
  (pre-request, during authorization, during approval) is tested to
  produce `status: "cancelled"` with zero `execute()` calls. Every path
  after `execute()` begins (mid-flight abort, mid-flight timeout, thrown
  error) is tested to produce `status: "unknown"`, never `"cancelled"` or
  `"failed"`. This matches the frozen behavior already implemented on
  `feat/execute`; this branch adds no new boundary, only proof of it.
- Timeout boundary: identical to the cancellation boundary — `timeoutMs`
  and a caller `signal` combine into one effective signal, so "timeout
  before execute" and "timeout after execute begins" are tested with the
  same assertions as pre-/post-start cancellation, using
  `vi.useFakeTimers()`/`vi.advanceTimersByTimeAsync()` (no real sleeps).
- Settlement-failure behavior: a `store.record()` failure occurring after
  a real capability success is tested to produce `status: "unknown"`
  (never a silent `"succeeded"`), preserving the settlement error as
  `error`. This is the existing `feat/execute` behavior; this branch adds
  an explicit test naming the property directly ("does not report safe
  success when the store cannot durably record completion") rather than
  leaving it implicit in a differently-named test.
- Concurrency strategy: deterministic promise gates (`started`/`released`
  resolvers) for running-duplicate tests; plain `Promise.all()` fan-out
  (25 calls) against the real `memoryStore()` for the core
  exactly-once-execution proof, since `memoryStore.claim()`'s synchronous
  check-then-set makes this deterministic without fake timers. No
  `setTimeout`-based sleep is used anywhere as a race-avoidance hack; the
  one `setTimeout(resolve, 0)` that existed in a pre-existing test was
  replaced with an explicit "wait for execution to start" promise gate
  during this branch's consolidation.
- No implementation defect was found. All safety properties (single
  claimed-per-identity, conflict detection, unknown persistence, replay
  without re-execution, cancellation/timeout-after-start classified as
  unknown, settlement-failure-as-unknown) held under adversarial review
  attempting to construct counterexamples in each case; none were found.
- Public API did not change. `dist/index.d.mts` built from this branch is
  byte-for-byte identical to the one built from `feat/execute`
  (`diff` confirms no difference). No file under `packages/ts/src`
  changed (`git diff feat/execute -- packages/ts/src/` is empty).

## Changed

- packages/ts/tests/execution-failures.test.ts: new. Invalid request
  metadata, invalid input, authorization (denied/throws), approval
  (not-required/approved/rejected/unavailable/throws/malformed-decision),
  store claim failure, ordinary thrown execution error, settlement
  failure after a real side effect, and observable pipeline ordering.
- packages/ts/tests/execution-replay.test.ts: new. Completed replay
  (including execution-identity preservation), running duplicate,
  conflicting duplicate (including proof the original claim/result is
  never overwritten and remains replayable), unknown duplicate, and the
  ambiguous-side-effect proof (`ambiguousGateway()`).
- packages/ts/tests/execution-concurrency.test.ts: new. N-concurrent
  identical requests (exactly one execution, same outcome for all
  callers, no duplicated ambiguous side effect under concurrency) and
  concurrent conflicting requests (exactly one execution, the rest
  conflict).
- packages/ts/tests/execution-cancellation.test.ts: renamed from
  `execute-cancellation.test.ts` and extended with authorization- and
  approval-boundary cancellation cases and a duplicate-does-not-execute-
  after-timeout case.
- packages/ts/tests/execution-happy-path.test.ts: renamed from
  `execute-happy-path.test.ts` (no content change beyond fixture import).
- packages/ts/tests/execution.type-test.ts: renamed from
  `execute.type-test.ts` (no content change).
- packages/ts/tests/execution-fixtures.ts: new. Shared `Refund` type,
  `refundParser`, and `baseRequest()` used only by the `execution-*.ts`
  files this branch owns; pre-existing test files
  (`capability.test.ts`, `schema.test.ts`, etc.) were left untouched to
  keep this branch's diff narrow.
- Deleted: `execute-preflight.test.ts`, `execute-unknown-and-order.test.ts`
  (content folded into `execution-failures.test.ts`); the running/
  replay/conflict/unknown sections of the old `execute-replay.test.ts`
  (folded into the new `execution-replay.test.ts` and
  `execution-concurrency.test.ts`).
- docs/work/active.md, docs/work/handoffs/failure-semantics.md: this
  handoff.

No file under packages/ts/src, packages/ts/scripts, package.json, or any
build/CI configuration changed.

## Invariants

Directly exercised by new/extended tests in this branch:

- "Store semantics are atomic where required" / "Duplicate execution is
  prevented": 25-way and 15-way concurrent identical-request tests, plus
  the running-duplicate promise-gated test.
- "Idempotency is explicit": conflicting-duplicate test proves the
  original claim's fingerprint/result is never overwritten and remains
  replayable after a conflicting attempt; concurrent-conflicting-requests
  test proves only one of several differing inputs ever executes.
- "Ambiguous outcomes are preserved": the `ambiguousGateway()` proof —
  side effect commits once, `unknown` surfaces, retries never re-execute.
- "Cancellation is cooperative" / "Timeout is not rollback": every
  pre-execute cancellation/timeout boundary (request, authorization,
  approval) proven non-executing; every post-execute boundary proven
  `unknown`, never misclassified.
- "Evidence is minimal" / settlement safety: settlement-failure-after-
  success proven to surface `unknown`, never a false `succeeded`.

## Verification

Run from packages/ts and from repo root; all passed:

- `bun install --frozen-lockfile`: passed.
- `bun --filter=@irogane/kaji run format:check`: passed.
- `bun --filter=@irogane/kaji run lint`: passed, 0 warnings/0 errors.
- `bun --filter=@irogane/kaji run typecheck`: passed.
- `bun --filter=@irogane/kaji run test`: passed, 84/84 tests across 11
  files.
- `bun --filter=@irogane/kaji run test` repeated 20 times in a row (this
  task's required determinism sweep): 20/20 runs passed, 84/84 each time,
  zero flakiness.
- `bun --filter=@irogane/kaji run build`: passed; `dist/index.d.mts`
  diffed byte-for-byte against the `feat/execute` build — identical,
  confirming zero public API change.
- `bun --filter=@irogane/kaji run package:check`: passed (publint + attw
  esm-only profile).
- `bun --filter=@irogane/kaji run package:smoke`: passed.
- Root-scoped `bun run format:check`, `bun run lint`, `bun run typecheck`,
  `bun run test`: all passed across both workspaces.
- Independent adversarial review (attempting to construct
  counterexamples, not restate invariants): attempted to break — two
  concurrent callers both claiming, unknown becoming reclaimable,
  conflict overwriting original state, replay invoking execute() again,
  post-start cancellation/timeout misclassified, settlement failure
  reported as false success. None were achievable; all held under
  inspection of the actual `execute.ts`/`memory-store.ts` control flow.
  Confirmed zero `packages/ts/src` changes, no sleep-based test
  synchronization, and mocks used only to inject the specific fault under
  test (never to fake away real claim/settlement semantics). Verdict:
  APPROVE WITH MINOR NOTES — one matrix gap (malformed approval-decision
  shape untested) and two tests missing an explicit execute-count
  assertion (functionally covered by sibling tests). Both notes were
  addressed: added a "malformed approval decision" test and added the
  missing execute-count assertions to the two flagged tests. Re-ran the
  full suite and 20-iteration determinism sweep after the fix — still
  84/84 passing, 20/20 stable.

## Remaining

- No implementation defect was found or fixed; this branch is test-only.
- No CI workflow change was made: the existing single `test` step in
  `.github/workflows/typescript-package.yml` already runs every file
  under `packages/ts/tests/` (vitest has no separate "failure tests" or
  "concurrency tests" command in this package, and adding one would
  duplicate `bun run test` without a behavioral difference).
- Automatic retries, a durable database backend, and agent/framework
  adapters remain unimplemented, as required by every prior branch in
  this sequence; nothing in this task changes that.

## Next

feat/proof-example
