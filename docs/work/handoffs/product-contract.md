# product-contract

State: DONE
Branch: docs/product-contract
Worktree: /Users/enkyuan/Desktop/Projects/kaji
Owner: design authority
Base SHA: b16665b7444e98e28a7f6ef15dcee163eac275b9
Head SHA: b16665b7444e98e28a7f6ef15dcee163eac275b9

## Goal

Freeze the smallest coherent TypeScript v0 contract for Kaji as the execution boundary between caller intent and application state changes. Do not implement SDK code.

## Decisions

- Kaji owns capability execution safety, not reasoning, planning, workflows, identity, authorization policy, or agent framework integration.
- The primary API concepts are `Capability` and the Kaji executor from `createKaji()`.
- A capability uses a structural parser contract instead of a Kaji schema abstraction.
- Kaji uses native `AbortSignal` semantics.
- A thrown or rejected capability `execute` call is `unknown` because the side effect may have committed.
- Idempotency keys are caller-supplied and globally identify one intended operation. Reuse with different input, capability, or principal is a conflict.
- Store interoperability types exist only because `createKaji()` accepts an execution store. Approval request and decision types remain inline rather than exported.

## Changed

- docs/product.md: Defines the v0 product boundary, use cases, scope, non-goals, and product test.
- docs/invariants.md: Defines execution safety invariants.
- docs/api.md: Defines the intended TypeScript v0 API and its export boundary.
- docs/work/active.md: Records the completed product-contract objective.
- docs/work/handoffs/product-contract.md: Records this handoff.

## Invariants

- Every capability execution follows one canonical path.
- Validation, authorization, approval, idempotency, and outcome recording cannot be bypassed.
- Potentially committed side effects remain `unknown` when completion cannot be proven.
- The core remains framework-neutral and uses native primitives first.

## Verification

- `git diff --check`: passed.
- `./apps/docs/node_modules/.bin/oxfmt --check docs`: passed.
- `bun run format:check`: passed.
- Adversarial simplification review: removed the exported `InputSchema`, `ApprovalRequest`, and `ApprovalDecision` concepts. Retained `ExecutionStore` only because callers provide it to `createKaji()`. Confirmed agent-framework, workflow, session, provider, and event-sourcing terms appear only in boundary or non-goal statements.

## Remaining

- No SDK code exists yet. Implementation must follow the three contract documents and add tests for each invariant.

## Next

Implement the TypeScript v0 API in a separate implementation task and worktree.
