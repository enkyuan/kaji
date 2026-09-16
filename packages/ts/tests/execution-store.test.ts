import { describe, expect, expectTypeOf, it } from "vitest";
import type {
  ClaimResult,
  ExecutionClaim,
  ExecutionStore,
  StoredExecution,
} from "../src/execution-store.ts";
import type { ExecutionEvidence } from "../src/execution-result.ts";

describe("ExecutionStore", () => {
  it("can be implemented by user code with only claim/record", async () => {
    const claims: ExecutionClaim[] = [];
    const recorded: StoredExecution[] = [];

    const store: ExecutionStore = {
      async claim(claim) {
        claims.push(claim);
        return { status: "claimed", executionId: "exec_1" };
      },
      async record(execution) {
        recorded.push(execution);
      },
    };

    const result = await store.claim({
      capability: "payments.refund",
      principalId: "user_1",
      idempotencyKey: "key_1",
      inputFingerprint: "fp_1",
    });

    expect(result).toEqual({ status: "claimed", executionId: "exec_1" });
    expect(claims).toHaveLength(1);
  });

  it("discriminates ClaimResult cleanly by status", () => {
    function describeResult(result: ClaimResult): string {
      switch (result.status) {
        case "claimed":
          expectTypeOf(result.executionId).toEqualTypeOf<string>();
          return "claimed";
        case "existing":
          expectTypeOf(result.outcome).toEqualTypeOf<Promise<StoredExecution>>();
          return "existing";
        case "conflict":
          expectTypeOf(result.executionId).toEqualTypeOf<string>();
          return "conflict";
      }
    }

    expect(describeResult({ status: "claimed", executionId: "exec_1" })).toBe("claimed");
  });

  it("StoredExecution evidence carries no `any`", () => {
    const evidence: ExecutionEvidence = {
      executionId: "exec_1",
      capability: "payments.refund",
      principalId: "user_1",
      idempotencyKey: "key_1",
      inputFingerprint: "fp_1",
    };

    expectTypeOf(evidence.executionId).toEqualTypeOf<string>();
    expectTypeOf(evidence.capability).toEqualTypeOf<string>();
  });
});
