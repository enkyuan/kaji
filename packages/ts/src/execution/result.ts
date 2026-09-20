/**
 * The minimal facts Kaji knows about one governed execution.
 *
 * This is deliberately not a general event or audit record: it carries only
 * what a caller needs to identify the execution and detect conflicting
 * idempotency key reuse. See docs/invariants.md "Evidence is minimal".
 */
export type ExecutionEvidence = {
  readonly executionId: string;
  readonly capability: string;
  readonly principalId: string;
  readonly idempotencyKey: string;
  readonly inputFingerprint: string;
};

/**
 * The explicit outcome of one governed execution, as frozen by docs/api.md.
 *
 * `unknown` is distinct from `failed`: it means the capability's side effect
 * may have committed but Kaji cannot prove the final result, so callers
 * must not treat it as an ordinary retryable failure.
 */
export type ExecutionResult<Result> =
  | {
      readonly status: "succeeded";
      readonly result: Result;
      readonly evidence: ExecutionEvidence;
    }
  | {
      readonly status: "denied" | "rejected" | "failed" | "cancelled";
      readonly error: unknown;
      readonly evidence: ExecutionEvidence;
    }
  | {
      readonly status: "unknown";
      readonly error: unknown;
      readonly evidence: ExecutionEvidence;
    };
