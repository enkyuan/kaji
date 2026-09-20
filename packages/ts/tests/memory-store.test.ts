import { describe, expect, it } from "vitest";
import { memoryStore } from "../src/store/memory.ts";
import type { ExecutionClaim } from "../src/store/store.ts";
import type { StoredExecution } from "../src/store/store.ts";

function claimOf(overrides: Partial<ExecutionClaim> = {}): ExecutionClaim {
  return {
    capability: "payments.refund",
    principalId: "user_1",
    idempotencyKey: "key_1",
    inputFingerprint: "fp_1",
    ...overrides,
  };
}

function succeeded(executionId: string, result: unknown = { refunded: true }): StoredExecution {
  return {
    status: "succeeded",
    result,
    evidence: {
      executionId,
      capability: "payments.refund",
      principalId: "user_1",
      idempotencyKey: "key_1",
      inputFingerprint: "fp_1",
    },
  };
}

function unknownOutcome(executionId: string): StoredExecution {
  return {
    status: "unknown",
    error: new Error("timed out"),
    evidence: {
      executionId,
      capability: "payments.refund",
      principalId: "user_1",
      idempotencyKey: "key_1",
      inputFingerprint: "fp_1",
    },
  };
}

describe("memoryStore claim semantics", () => {
  it("grants the first claim for a new identity", async () => {
    const store = memoryStore();
    const result = await store.claim(claimOf());

    expect(result.status).toBe("claimed");
  });

  it("does not grant a second claim while the first is still running", async () => {
    const store = memoryStore();
    await store.claim(claimOf());

    const second = await store.claim(claimOf());

    expect(second.status).toBe("existing");
  });

  it("permits exactly one claim among concurrent identical claims", async () => {
    const store = memoryStore();

    const results = await Promise.all(Array.from({ length: 20 }, () => store.claim(claimOf())));

    const claimed = results.filter((result) => result.status === "claimed");
    const existing = results.filter((result) => result.status === "existing");

    expect(claimed).toHaveLength(1);
    expect(existing).toHaveLength(19);
  });

  it("reports a conflict when the same identity reuses a different fingerprint", async () => {
    const store = memoryStore();
    await store.claim(claimOf({ inputFingerprint: "fp_1" }));

    const conflicting = await store.claim(claimOf({ inputFingerprint: "fp_2" }));

    expect(conflicting.status).toBe("conflict");
  });

  it("keeps claim state stable across repeated claims", async () => {
    const store = memoryStore();
    const first = await store.claim(claimOf());
    const second = await store.claim(claimOf());
    const third = await store.claim(claimOf());

    expect(first.status).toBe("claimed");
    expect(second.status).toBe("existing");
    expect(third.status).toBe("existing");
  });

  it("does not let separate idempotency keys interfere", async () => {
    const store = memoryStore();
    const first = await store.claim(claimOf({ idempotencyKey: "key_1" }));
    const second = await store.claim(claimOf({ idempotencyKey: "key_2" }));

    expect(first.status).toBe("claimed");
    expect(second.status).toBe("claimed");
  });

  it("does not let separate capabilities collide on the same idempotency key", async () => {
    const store = memoryStore();
    const first = await store.claim(claimOf({ capability: "payments.refund" }));
    const second = await store.claim(claimOf({ capability: "booking.cancel" }));

    expect(first.status).toBe("claimed");
    expect(second.status).toBe("claimed");
  });

  it("does not let separate principals collide on the same idempotency key", async () => {
    const store = memoryStore();
    const first = await store.claim(claimOf({ principalId: "user_1" }));
    const second = await store.claim(claimOf({ principalId: "user_2" }));

    expect(first.status).toBe("claimed");
    expect(second.status).toBe("claimed");
  });
});

describe("memoryStore settlement", () => {
  it("resolves a claimed execution's outcome once recorded as succeeded", async () => {
    const store = memoryStore();
    const claimed = await store.claim(claimOf());
    if (claimed.status !== "claimed") throw new Error("expected claimed");

    const existing = await store.claim(claimOf());
    if (existing.status !== "existing") throw new Error("expected existing");

    await store.record(succeeded(claimed.executionId));

    await expect(existing.outcome).resolves.toMatchObject({ status: "succeeded" });
  });

  it("resolves a claimed execution's outcome once recorded as unknown", async () => {
    const store = memoryStore();
    const claimed = await store.claim(claimOf());
    if (claimed.status !== "claimed") throw new Error("expected claimed");

    const existing = await store.claim(claimOf());
    if (existing.status !== "existing") throw new Error("expected existing");

    await store.record(unknownOutcome(claimed.executionId));

    await expect(existing.outcome).resolves.toMatchObject({ status: "unknown" });
  });

  it("replays a completed execution's result to a later identical claim", async () => {
    const store = memoryStore();
    const claimed = await store.claim(claimOf());
    if (claimed.status !== "claimed") throw new Error("expected claimed");
    await store.record(succeeded(claimed.executionId, { refunded: 750 }));

    const replay = await store.claim(claimOf());
    if (replay.status !== "existing") throw new Error("expected existing");
    const outcome = await replay.outcome;

    expect(outcome).toMatchObject({ status: "succeeded", result: { refunded: 750 } });
  });

  it("does not permit a blind reclaim after an unknown outcome", async () => {
    const store = memoryStore();
    const claimed = await store.claim(claimOf());
    if (claimed.status !== "claimed") throw new Error("expected claimed");
    await store.record(unknownOutcome(claimed.executionId));

    const later = await store.claim(claimOf());

    expect(later.status).toBe("existing");
    await expect((later as { outcome: Promise<StoredExecution> }).outcome).resolves.toMatchObject({
      status: "unknown",
    });
  });

  it("rejects settling an execution that was never claimed", async () => {
    const store = memoryStore();

    await expect(store.record(succeeded("exec_never_claimed"))).rejects.toThrow(/unclaimed/);
  });

  it("rejects a second settlement of the same execution", async () => {
    const store = memoryStore();
    const claimed = await store.claim(claimOf());
    if (claimed.status !== "claimed") throw new Error("expected claimed");

    await store.record(succeeded(claimed.executionId));

    await expect(store.record(unknownOutcome(claimed.executionId))).rejects.toThrow(/twice/);
  });
});
