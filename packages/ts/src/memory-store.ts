import type {
  ClaimResult,
  ExecutionClaim,
  ExecutionStore,
  StoredExecution,
} from "./execution-store.ts";

/**
 * One claimed execution's in-memory state. `settle` resolves `outcome` for
 * every caller that received `"existing"` while this execution was still
 * running, so they observe the real result instead of racing `record()`.
 */
type ClaimedExecution = {
  readonly claim: ExecutionClaim;
  readonly executionId: string;
  readonly outcome: Promise<StoredExecution>;
  readonly settle: (execution: StoredExecution) => void;
  settled: boolean;
};

/**
 * A process-local reference `ExecutionStore`. It has no external
 * persistence, no cross-process visibility, and no durability guarantee —
 * it exists for development, tests, and examples, but honors the same
 * claim/record contract a durable store must honor.
 */
export function memoryStore(): ExecutionStore {
  const claims = new Map<string, ClaimedExecution>();

  return {
    async claim(claim: ExecutionClaim): Promise<ClaimResult> {
      const identity = identityKey(claim);
      const existing = claims.get(identity);

      if (existing !== undefined) {
        if (existing.claim.inputFingerprint !== claim.inputFingerprint) {
          return { status: "conflict", executionId: existing.executionId };
        }
        return { status: "existing", outcome: existing.outcome };
      }

      // Map.set is synchronous, so no other caller can observe this
      // identity as absent between the `get` above and this `set`:
      // exactly one caller per identity reaches this branch.
      let settle!: (execution: StoredExecution) => void;
      const outcome = new Promise<StoredExecution>((resolve) => {
        settle = resolve;
      });
      const executionId = crypto.randomUUID();
      claims.set(identity, { claim, executionId, outcome, settle, settled: false });

      return { status: "claimed", executionId };
    },

    async record(execution: StoredExecution): Promise<void> {
      const identity = identityKey(execution.evidence);
      const entry = claims.get(identity);
      if (entry === undefined || entry.executionId !== execution.evidence.executionId) {
        throw new Error(
          `record() called for unclaimed executionId "${execution.evidence.executionId}".`,
        );
      }
      // A claimed execution's outcome is terminal once recorded. Allowing a
      // second call to silently overwrite it could turn a settled `unknown`
      // into `succeeded`, hiding a side effect Kaji could not actually
      // confirm.
      if (entry.settled) {
        throw new Error(`record() called twice for executionId "${entry.executionId}".`);
      }
      entry.settled = true;
      entry.settle(execution);
    },
  };
}

function identityKey(claim: ExecutionClaim): string {
  return `${claim.capability}:${claim.principalId}:${claim.idempotencyKey}`;
}
