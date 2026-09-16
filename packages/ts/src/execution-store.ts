import type { ExecutionResult } from "./execution-result.ts";

/**
 * The material identity of one intended operation: which capability, which
 * principal, which caller-supplied idempotency key, and a fingerprint of
 * the validated input. The store uses this tuple to detect duplicate
 * claims and conflicting reuse; it never sees the raw input or the
 * capability's callbacks.
 */
export type ExecutionClaim = {
  readonly capability: string;
  readonly principalId: string;
  readonly idempotencyKey: string;
  readonly inputFingerprint: string;
};

/** The terminal or in-flight record a store persists for one execution. */
export type StoredExecution = ExecutionResult<unknown>;

/**
 * The outcome of attempting to claim one execution.
 *
 * `"existing"` covers both an execution still running and one already
 * settled: its `outcome` promise resolves once the claim is recorded,
 * so a caller that must not duplicate a side effect can simply await it
 * instead of the store exposing separate running/completed/unknown states.
 */
export type ClaimResult =
  | { readonly status: "claimed"; readonly executionId: string }
  | { readonly status: "existing"; readonly outcome: Promise<StoredExecution> }
  | { readonly status: "conflict"; readonly executionId: string };

/**
 * Persists execution identity, idempotency claims, and minimal outcome
 * evidence. A store does not execute capabilities, enforce authorization
 * or approval, or decide retries — it only answers whether an execution
 * may begin and records what happened once it is known.
 *
 * `claim()` must be atomic enough that concurrent claims for the same
 * identity produce exactly one `"claimed"` result; see docs/invariants.md
 * "Store semantics are atomic where required".
 */
export type ExecutionStore = {
  claim(claim: ExecutionClaim): Promise<ClaimResult>;
  record(execution: StoredExecution): Promise<void>;
};
