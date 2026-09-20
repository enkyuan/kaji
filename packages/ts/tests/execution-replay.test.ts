import { describe, expect, it, vi } from "vitest";
import { capability } from "../src/capability.ts";
import { createKaji } from "../src/kaji.ts";
import { memoryStore } from "../src/store/memory.ts";
import { baseRequest, refundSchema, type Refund } from "./execution-fixtures.ts";
import type { StandardSchemaV1 } from "../src/schema.ts";

/**
 * A fake external action that commits its effect before it can acknowledge
 * completion: the refund provider applies the refund, then the connection
 * fails before the response reaches the capability. This is the shape of
 * ambiguity Kaji's `unknown` outcome exists for — the side effect
 * genuinely happened, but the capability itself cannot prove that to Kaji.
 */
function ambiguousGateway() {
  let committed = false;
  return {
    committed: () => committed,
    refund: async (amount: number): Promise<never> => {
      committed = true;
      throw new Error(`connection lost after committing refund of ${amount}`);
    },
  };
}

describe("completed replay", () => {
  it("returns the stored result without executing again", async () => {
    const store = memoryStore();
    const execute = vi.fn(async (input: Refund) => ({ refunded: input.amount }));
    const refund = capability({
      name: "payments.refund",
      input: refundSchema,
      authorize: () => true,
      execute,
    });
    const kaji = createKaji({ store });

    const first = await kaji.execute(refund, baseRequest());
    const second = await kaji.execute(refund, baseRequest());
    const third = await kaji.execute(refund, baseRequest());

    expect(execute).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
    expect(third).toEqual(first);
    expect(second.status).toBe("succeeded");
  });

  it("preserves execution identity across replays", async () => {
    const store = memoryStore();
    const execute = vi.fn(async (input: Refund) => input);
    const refund = capability({
      name: "payments.refund",
      input: refundSchema,
      authorize: () => true,
      execute,
    });
    const kaji = createKaji({ store });

    const first = await kaji.execute(refund, baseRequest());
    const second = await kaji.execute(refund, baseRequest());

    expect(execute).toHaveBeenCalledTimes(1);
    if (first.status === "succeeded" && second.status === "succeeded") {
      expect(second.evidence.executionId).toBe(first.evidence.executionId);
      expect(second.evidence.inputFingerprint).toBe(first.evidence.inputFingerprint);
    } else {
      throw new Error("expected both executions to succeed");
    }
  });
});

describe("running duplicate", () => {
  it("does not execute again while the first call is still in flight", async () => {
    let executionStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      executionStarted = resolve;
    });
    let releaseFirst!: () => void;
    const released = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const execute = vi.fn(async (input: Refund) => {
      executionStarted();
      await released;
      return input;
    });
    const refund = capability({
      name: "payments.refund",
      input: refundSchema,
      authorize: () => true,
      execute,
    });
    const kaji = createKaji({ store: memoryStore() });

    const firstCall = kaji.execute(refund, baseRequest());
    await started;
    const secondCall = kaji.execute(refund, baseRequest());

    releaseFirst();
    const [first, second] = await Promise.all([firstCall, secondCall]);

    expect(execute).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });
});

describe("conflicting duplicate", () => {
  it("does not execute and does not overwrite the original claim", async () => {
    const store = memoryStore();
    const execute = vi.fn(async (input: Refund) => ({ refunded: input.amount }));
    const refund = capability({
      name: "payments.refund",
      input: refundSchema,
      authorize: () => true,
      execute,
    });
    const kaji = createKaji({ store });

    const original = await kaji.execute(
      refund,
      baseRequest({ input: { paymentId: "pay_1", amount: 10 } }),
    );
    const conflicting = await kaji.execute(
      refund,
      baseRequest({ input: { paymentId: "pay_1", amount: 999 } }),
    );

    expect(conflicting.status).toBe("failed");
    expect(execute).toHaveBeenCalledTimes(1);

    // The original completed execution must remain exactly as it was and
    // must still be replayable after the conflicting attempt.
    const replay = await kaji.execute(
      refund,
      baseRequest({ input: { paymentId: "pay_1", amount: 10 } }),
    );
    expect(replay).toEqual(original);
    expect(execute).toHaveBeenCalledTimes(1);
  });
});

describe("unknown duplicate", () => {
  it("does not execute again after an explicit unknown outcome", async () => {
    const execute = vi.fn().mockRejectedValue(new Error("ambiguous"));
    const refund = capability({
      name: "payments.refund",
      input: refundSchema,
      authorize: () => true,
      execute,
    });
    const kaji = createKaji({ store: memoryStore() });

    const first = await kaji.execute(refund, baseRequest());
    const second = await kaji.execute(refund, baseRequest());
    const third = await kaji.execute(refund, baseRequest());

    expect(first.status).toBe("unknown");
    expect(second.status).toBe("unknown");
    expect(third.status).toBe("unknown");
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("never lets unknown become completed or failed through replay", async () => {
    const execute = vi.fn().mockRejectedValue(new Error("ambiguous"));
    const refund = capability({
      name: "payments.refund",
      input: refundSchema,
      authorize: () => true,
      execute,
    });
    const kaji = createKaji({ store: memoryStore() });

    await kaji.execute(refund, baseRequest());
    const replays = await Promise.all(
      Array.from({ length: 5 }, () => kaji.execute(refund, baseRequest())),
    );

    for (const result of replays) {
      expect(result.status).toBe("unknown");
    }
    expect(execute).toHaveBeenCalledTimes(1);
  });
});

describe("ambiguous side effect", () => {
  it("commits the side effect exactly once and never executes it again", async () => {
    const gateway = ambiguousGateway();
    const execute = vi.fn(async (input: Refund) => gateway.refund(input.amount));
    const refund = capability({
      name: "payments.refund",
      input: refundSchema,
      authorize: () => true,
      execute,
    });
    const kaji = createKaji({ store: memoryStore() });

    const first = await kaji.execute(refund, baseRequest());
    const second = await kaji.execute(refund, baseRequest());
    const third = await kaji.execute(refund, baseRequest());

    expect(gateway.committed()).toBe(true);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(first.status).toBe("unknown");
    expect(second.status).toBe("unknown");
    expect(third.status).toBe("unknown");
  });

  it("surfaces unknown distinctly from an ordinary failure", async () => {
    const gateway = ambiguousGateway();
    const execute = vi.fn(async (input: Refund) => gateway.refund(input.amount));
    const refund = capability({
      name: "payments.refund",
      input: refundSchema,
      authorize: () => true,
      execute,
    });
    const kaji = createKaji({ store: memoryStore() });

    const result = await kaji.execute(refund, baseRequest());

    expect(execute).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("unknown");
    expect(result.status).not.toBe("failed");
  });

  it("a later retry with the same idempotency key cannot duplicate the committed side effect", async () => {
    const gateway = ambiguousGateway();
    let commitCount = 0;
    const execute = vi.fn(async (input: Refund) => {
      commitCount += 1;
      return gateway.refund(input.amount);
    });
    const refund = capability({
      name: "payments.refund",
      input: refundSchema,
      authorize: () => true,
      execute,
    });
    const kaji = createKaji({ store: memoryStore() });

    await kaji.execute(refund, baseRequest());
    // A caller retrying after the ambiguous failure, believing the first
    // attempt may not have gone through, must not trigger a second commit.
    await kaji.execute(refund, baseRequest());
    await kaji.execute(refund, baseRequest());

    expect(commitCount).toBe(1);
  });
});

describe("fingerprinting validated output", () => {
  // The fingerprint must cover the schema's validated OUTPUT, not the raw
  // request input: two raw inputs that transform to the same value claim
  // the same operation and replay, while differently-transformed values
  // would conflict.
  it("replays when different raw inputs transform to the same validated output", async () => {
    const store = memoryStore();
    const execute = vi.fn(async (input: number) => ({ amount: input }));

    const amount: StandardSchemaV1<string, number> = {
      "~standard": {
        version: 1,
        vendor: "test",
        validate: (value) => ({ value: Number(value) }),
        types: { input: null as unknown as string, output: null as unknown as number },
      },
    };
    const charge = capability({
      name: "payments.charge",
      input: amount,
      authorize: () => true,
      execute,
    });
    const kaji = createKaji({ store });

    const first = await kaji.execute(charge, {
      input: "10",
      principalId: "user_1",
      idempotencyKey: "key_1",
    });
    const second = await kaji.execute(charge, {
      input: "10.0",
      principalId: "user_1",
      idempotencyKey: "key_1",
    });

    expect(first.status).toBe("succeeded");
    expect(second.status).toBe("succeeded");
    expect(execute).toHaveBeenCalledTimes(1);
    if (first.status === "succeeded" && second.status === "succeeded") {
      expect(second.evidence.executionId).toBe(first.evidence.executionId);
      expect(second.result).toEqual(first.result);
    }
  });
});
