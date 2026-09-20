/**
 * One caller's request to run a capability, as frozen by docs/api.md.
 * `principalId` and `idempotencyKey` are supplied by the caller — Kaji
 * never infers either from process state (docs/invariants.md
 * "Principal is explicit").
 */
export type ExecutionRequest = {
  readonly input: unknown;
  readonly principalId: string;
  readonly idempotencyKey: string;
  readonly signal?: AbortSignal;
};
