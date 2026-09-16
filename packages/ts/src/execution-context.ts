/**
 * The information a capability's `execute` function needs to run safely.
 *
 * This stays intentionally small: no store, registry, session, or engine
 * reference. Identity is exactly `principalId`. Cancellation uses the
 * platform's native `AbortSignal` instead of a Kaji-specific token.
 */
export type ExecutionContext = {
  readonly principalId: string;
  readonly idempotencyKey: string;
  readonly signal: AbortSignal;
};
