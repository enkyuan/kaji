import { describe, expect, it, vi } from "vitest";
import { capability } from "../src/capability.ts";
import { createKaji } from "../src/kaji.ts";
import { memoryStore } from "../src/memory-store.ts";
import type { InputParser } from "../src/schema.ts";
import type { ExecutionStore } from "../src/execution-store.ts";

type Refund = { paymentId: string; amount: number };

const refundParser: InputParser<Refund> = {
  parse: (value) => value as Refund,
};

function baseRequest(overrides: Record<string, unknown> = {}) {
  return {
    input: { paymentId: "pay_1", amount: 10 },
    principalId: "user_1",
    idempotencyKey: "key_1",
    ...overrides,
  };
}

describe("unknown outcome", () => {
  it("a thrown execute() settles unknown and preserves the cause", async () => {
    const cause = new Error("remote refund provider timed out");
    const refund = capability({
      name: "payments.refund",
      input: refundParser,
      authorize: () => true,
      execute: async () => {
        throw cause;
      },
    });
    const kaji = createKaji({ store: memoryStore() });

    const result = await kaji.execute(refund, baseRequest());

    expect(result.status).toBe("unknown");
    if (result.status === "unknown") {
      expect(result.error).toBe(cause);
    }
  });

  it("unknown is surfaced distinctly from failure and denial", async () => {
    const refund = capability({
      name: "payments.refund",
      input: refundParser,
      authorize: () => true,
      execute: async () => {
        throw new Error("ambiguous");
      },
    });
    const kaji = createKaji({ store: memoryStore() });

    const result = await kaji.execute(refund, baseRequest());

    expect(result.status).not.toBe("failed");
    expect(result.status).not.toBe("denied");
    expect(result.status).toBe("unknown");
  });

  it("a subsequent identical request cannot execute again after unknown", async () => {
    const execute = vi
      .fn<(input: Refund) => Promise<Refund>>()
      .mockRejectedValue(new Error("ambiguous"));
    const refund = capability({
      name: "payments.refund",
      input: refundParser,
      authorize: () => true,
      execute,
    });
    const kaji = createKaji({ store: memoryStore() });

    await kaji.execute(refund, baseRequest());
    const second = await kaji.execute(refund, baseRequest());

    expect(second.status).toBe("unknown");
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("unknown never becomes completed or failed on replay", async () => {
    const refund = capability({
      name: "payments.refund",
      input: refundParser,
      authorize: () => true,
      execute: async () => {
        throw new Error("ambiguous");
      },
    });
    const kaji = createKaji({ store: memoryStore() });

    await kaji.execute(refund, baseRequest());
    const second = await kaji.execute(refund, baseRequest());
    const third = await kaji.execute(refund, baseRequest());

    expect(second.status).toBe("unknown");
    expect(third.status).toBe("unknown");
  });
});

describe("store failure", () => {
  it("a claim failure prevents execution", async () => {
    const cause = new Error("store unavailable");
    const store: ExecutionStore = {
      claim: vi.fn(async () => {
        throw cause;
      }),
      record: vi.fn(async () => {}),
    };
    const execute = vi.fn(async (input: Refund) => input);
    const refund = capability({
      name: "payments.refund",
      input: refundParser,
      authorize: () => true,
      execute,
    });
    const kaji = createKaji({ store });

    await expect(kaji.execute(refund, baseRequest())).rejects.toThrow();
    expect(execute).not.toHaveBeenCalled();
  });

  it("preserves the original store error as the cause", async () => {
    const cause = new Error("store unavailable");
    const store: ExecutionStore = {
      claim: vi.fn(async () => {
        throw cause;
      }),
      record: vi.fn(async () => {}),
    };
    const refund = capability({
      name: "payments.refund",
      input: refundParser,
      authorize: () => true,
      execute: async (input) => input,
    });
    const kaji = createKaji({ store });

    await expect(kaji.execute(refund, baseRequest())).rejects.toMatchObject({ cause });
  });

  it("a settlement failure after a real success does not silently report safe success", async () => {
    const memory = memoryStore();
    const store: ExecutionStore = {
      claim: (claim) => memory.claim(claim),
      record: vi.fn(async () => {
        throw new Error("record unavailable");
      }),
    };
    const refund = capability({
      name: "payments.refund",
      input: refundParser,
      authorize: () => true,
      execute: async (input: Refund) => ({ refunded: input.amount }),
    });
    const kaji = createKaji({ store });

    const result = await kaji.execute(refund, baseRequest());

    // The capability itself succeeded, but Kaji could not durably record
    // that outcome, so it must not tell the caller the action safely
    // completed.
    expect(result.status).toBe("unknown");
  });

  it("preserves the original settlement error as the cause on ambiguous post-execution failure", async () => {
    const settlementCause = new Error("record unavailable");
    const memory = memoryStore();
    const store: ExecutionStore = {
      claim: (claim) => memory.claim(claim),
      record: vi.fn(async () => {
        throw settlementCause;
      }),
    };
    const refund = capability({
      name: "payments.refund",
      input: refundParser,
      authorize: () => true,
      execute: async (input: Refund) => input,
    });
    const kaji = createKaji({ store });

    const result = await kaji.execute(refund, baseRequest());

    if (result.status === "unknown") {
      expect(result.error).toBe(settlementCause);
    }
  });
});

describe("observable pipeline order", () => {
  it("runs validate, claim, authorize, approval, execute, settle in order exactly once each", async () => {
    const calls: string[] = [];
    const store = memoryStore();
    const originalClaim = store.claim.bind(store);
    const originalRecord = store.record.bind(store);
    const instrumented: ExecutionStore = {
      claim: async (claim) => {
        calls.push("claim");
        return originalClaim(claim);
      },
      record: async (execution) => {
        calls.push("settle");
        return originalRecord(execution);
      },
    };

    const refund = capability({
      name: "payments.refund",
      input: {
        parse: (value) => {
          calls.push("validate");
          return value as Refund;
        },
      },
      authorize: () => {
        calls.push("authorize");
        return true;
      },
      approval: () => {
        calls.push("approval");
        return true;
      },
      execute: async (input) => {
        calls.push("execute");
        return input;
      },
    });
    const kaji = createKaji({ store: instrumented, approve: async () => ({ approved: true }) });

    await kaji.execute(refund, baseRequest());

    expect(calls).toEqual(["validate", "claim", "authorize", "approval", "execute", "settle"]);
  });
});
