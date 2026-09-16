import type { ApproveHandler } from "./approval.ts";
import type { Capability } from "./capability.ts";
import { executeCapability } from "./execute.ts";
import type { ExecutionRequest } from "./execution-request.ts";
import type { ExecutionResult } from "./execution-result.ts";
import type { ExecutionStore } from "./execution-store.ts";

/** Stable application configuration for the executor, per docs/api.md. */
export type KajiOptions = {
  readonly store: ExecutionStore;
  readonly approve?: ApproveHandler;
  readonly timeoutMs?: number;
};

/** The Kaji executor, as frozen by docs/api.md. */
export type Kaji = {
  execute<Input, Result>(
    capability: Capability<Input, Result>,
    request: ExecutionRequest,
  ): Promise<ExecutionResult<Result>>;
};

/**
 * Creates the Kaji executor: the one canonical entry point for running a
 * capability. `kaji.execute()` validates the request, claims its
 * idempotency key, authorizes and approves it, calls the capability at
 * most once, and records the explicit outcome.
 */
export function createKaji(options: KajiOptions): Kaji {
  return {
    execute(capability, request) {
      return executeCapability(options, capability, request);
    },
  };
}
