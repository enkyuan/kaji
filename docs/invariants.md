# Invariants

## One execution path

Rule:
All capability execution must use one canonical execution path.

Why:
A second path can omit a required safety boundary.

Failure example:
A convenience method calls a capability's `execute` function directly and skips approval.

## Application owns domain logic

Rule:
Kaji must not embed business-specific behavior, and a capability's `execute` function must remain ordinary application code.

Why:
Only the application knows what a refund, cancellation, or document edit means.

Failure example:
Kaji adds a refund policy that changes which payments an application may refund.

## Principal is explicit

Rule:
Every execution must include a non-empty `principalId` string, and Kaji must not infer identity from global or process state.

Why:
Authorization and evidence need a clear actor.

Failure example:
Kaji reads a module-level current user when the caller omits `principalId`.

## Validation precedes execution

Rule:
Invalid input must never reach authorization-sensitive or side-effecting application code.

Why:
Application code must receive validated input only.

Failure example:
An invalid refund amount reaches `refundPayment()` after authorization succeeds.

## Authorization precedes side effects

Rule:
An authorization failure must prevent execution; Kaji provides the authorization boundary but must not become the application's IAM system.

Why:
The application owns policy, while Kaji enforces the decision before effects occur.

Failure example:
Kaji calls an email provider after the authorization hook returns `false`.

## Approval is fail-closed

Rule:
When an action requires approval, Kaji must not execute it unless it obtains a valid approval decision.

Why:
Missing, invalid, rejected, or failed approval cannot authorize a side effect.

Failure example:
Kaji executes a high-value refund because the approval provider timed out.

## Idempotency is explicit

Rule:
A caller-supplied idempotency key must identify one intended operation, and reuse with materially different input must fail as a conflict.

Why:
A key cannot safely represent two actions.

Failure example:
One key first refunds $10 and later refunds $100.

## Duplicate execution is prevented

Rule:
Concurrent or retried executions of the same operation must not independently perform the side effect.

Why:
Retries and racing callers must not create duplicate effects.

Failure example:
Two requests with the same key both send the same email.

## Ambiguous outcomes are preserved

Rule:
When a side effect may have happened but completion cannot be proven, Kaji must record the outcome as `unknown`.

Why:
`unknown` is not an ordinary failure and cannot be blindly retried.

Failure example:
Kaji converts a network failure after a remote refund request into `failed` and retries it automatically.

## Known failure is explicit

Rule:
Kaji must classify a capability's thrown or rejected `execute` call as `unknown` by default and may only record `failed` when application code throws `knownFailure(cause)`. Kaji must never infer this classification from an error's class, message, or status code.

Why:
Only application code can know whether its own side effect committed before an error surfaced; guessing from error shape risks retrying an action that already happened.

Failure example:
Kaji treats any error whose message contains "declined" as `failed` without application code asserting that no side effect occurred.

## Cancellation is cooperative

Rule:
Kaji must use native `AbortSignal` semantics; cancellation before side-effect execution must prevent the action, while cancellation after a potentially committed external effect must not imply rollback.

Why:
Cancellation can stop cooperation but cannot undo an already committed remote effect.

Failure example:
Kaji reports a sent email as unsent because its signal aborted after the provider accepted it.

## Timeout is not rollback

Rule:
A timeout must mean that Kaji stopped waiting, not that a remote side effect did not happen.

Why:
Remote systems can complete after Kaji's wait ends.

Failure example:
Kaji automatically repeats a timed-out deployment as though the first deployment never started.

## Evidence is minimal

Rule:
Kaji must persist only the information needed to reason about execution identity, claim, input fingerprint, status or outcome, and result or error evidence.

Why:
v0 needs execution evidence, not a general event-sourcing system.

Failure example:
Kaji stores arbitrary application events and conversation transcripts for every execution.

## Store semantics are atomic where required

Rule:
Claiming an idempotency key must provide enough atomicity to prevent duplicate execution under concurrency.

Why:
A check-then-create sequence can allow two side effects.

Failure example:
Two workers both observe that a key is absent and each create a claim.

## Framework neutrality

Rule:
No core type or execution primitive may depend on OpenAI, Anthropic, LangGraph, Vercel AI SDK, MCP, or another agent framework.

Why:
Kaji must govern the same capability regardless of the caller.

Failure example:
A capability type requires an OpenAI tool-call object.

## Small public surface

Rule:
Internal implementation machinery must remain internal, and a new public export requires a demonstrated caller requirement.

Why:
A small contract is easier to preserve and port.

Failure example:
Kaji exports its lock, persistence, and error-normalization internals without a caller need.

## Native primitives first

Rule:
Kaji must prefer platform primitives such as `AbortSignal` before introducing Kaji-specific equivalents.

Why:
Standard primitives reduce concepts and interoperate with application code.

Failure example:
Kaji adds a custom cancellation token alongside `AbortSignal`.

## Human-readable implementation

Rule:
Names, files, types, and control flow must expose intent without requiring historical context.

Why:
Engineers must be able to maintain the execution boundary safely.

Failure example:
A public `process()` method hides validation, approval, and outcome recording behind unnamed helpers.

## Unknown states remain explicit

Rule:
Kaji must not collapse distinct states when doing so could make unsafe behavior possible.

Why:
Callers need to distinguish a denied action, a failed action, and an ambiguous action.

Failure example:
The API reports both a rejected approval and a possibly committed remote timeout as `failed`.

Any implementation that violates an invariant must change the implementation, not weaken the invariant, unless a deliberate product decision updates this document first.
