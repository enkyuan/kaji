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
An authorization failure must prevent capability execution. Kaji must enforce the authorization boundary without becoming the application's IAM system.

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

## Application owns approval evidence

Rule:
Kaji can accept optional approval evidence, but it must not present minimal execution evidence as an approval audit record.

Why:
The application approval system owns evidence retention, access, and audit requirements.

Failure example:
An application assumes that `ExecutionStore` retained approval evidence that Kaji discarded.

## Idempotency is explicit

Rule:
The capability, principal ID, and idempotency key must identify one intended operation. Reuse with different validated input must fail as a conflict.

Why:
One execution identity cannot safely represent two actions.

Failure example:
One execution identity first refunds $10 and later refunds $100.

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
Kaji must classify a thrown or rejected `execute` call as `unknown` by default. Application code can select `failed` with `knownFailure(cause)`.

Kaji must never infer this classification from an error class, message, or status code.

Why:
Only application code knows whether its side effect committed before an error surfaced. Inference from the error can cause an unsafe retry.

Failure example:
Kaji treats any error whose message contains "declined" as `failed` without application code asserting that no side effect occurred.

## Cancellation is cooperative

Rule:
Kaji must use native `AbortSignal` semantics. Cancellation before capability execution must prevent the action.

Cancellation after capability execution begins must not imply rollback.

Why:
Cancellation can stop cooperation but cannot undo an already committed remote effect.

Failure example:
Kaji reports a sent email as unsent because its signal aborted after the provider accepted it.

## Timeout is cooperative

Rule:
`timeoutMs` must abort the effective `AbortSignal` after the configured duration. Kaji must continue awaiting `execute()` until it settles.

Why:
Kaji cannot forcibly stop application code. The capability or downstream API must observe the signal for the timeout to interrupt work.

Failure example:
Kaji describes `timeoutMs` as a wall-clock limit even though an `execute()` function that ignores the signal can later return `succeeded`.

## Evidence is minimal

Rule:
The store contract must record only execution identity, claim state, input fingerprint, status, and minimal result or error evidence.

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
Core types and execution primitives must not depend on an agent framework.

This restriction includes OpenAI, Anthropic, LangGraph, Vercel AI SDK, and MCP.

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

An implementation that violates an invariant must change. Only a deliberate product decision can update an invariant.
