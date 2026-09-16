import { describe, expect, it, vi } from "vitest";
import { capability } from "../src/capability.ts";
import { createKaji } from "../src/kaji.ts";
import { memoryStore } from "../src/memory-store.ts";
import type { InputParser } from "../src/schema.ts";

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

describe("replay and duplicates", () => {
  it("returns the stored result for a completed matching request without executing again", async () => {
    const store = memoryStore();
    const execute = vi.fn(async (input: Refund) => ({ refunded: input.amount }));
    const refund = capability({
      name: "payments.refund",
      input: refundParser,
      authorize: () => true,
      execute,
    });
    const kaji = createKaji({ store });

    const first = await kaji.execute(refund, baseRequest());
    const second = await kaji.execute(refund, baseRequest());

    expect(execute).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
    expect(second.status).toBe("succeeded");
  });

  it("does not execute the capability again for a completed replay", async () => {
    const store = memoryStore();
    const execute = vi.fn(async (input: Refund) => input);
    const refund = capability({
      name: "payments.refund",
      input: refundParser,
      authorize: () => true,
      execute,
    });
    const kaji = createKaji({ store });

    await kaji.execute(refund, baseRequest());
    await kaji.execute(refund, baseRequest());
    await kaji.execute(refund, baseRequest());

    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("a running duplicate does not execute", async () => {
    const store = memoryStore();
    let releaseFirst!: () => void;
    const started = new Promise<void>((resolve) => {
      releaseFirst = () => resolve();
    });
    const execute = vi.fn(async (input: Refund) => {
      await new Promise<void>((resolve) => {
        started.then(resolve);
      });
      return input;
    });
    const refund = capability({
      name: "payments.refund",
      input: refundParser,
      authorize: () => true,
      execute,
    });
    const kaji = createKaji({ store });

    const firstCall = kaji.execute(refund, baseRequest());
    // Give the first call a chance to claim before the second call starts.
    await new Promise((resolve) => setTimeout(resolve, 0));
    const secondCall = kaji.execute(refund, baseRequest());

    releaseFirst();
    const [first, second] = await Promise.all([firstCall, secondCall]);

    expect(execute).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });

  it("a conflicting fingerprint does not execute and fails as a conflict", async () => {
    const store = memoryStore();
    const execute = vi.fn(async (input: Refund) => input);
    const refund = capability({
      name: "payments.refund",
      input: refundParser,
      authorize: () => true,
      execute,
    });
    const kaji = createKaji({ store });

    await kaji.execute(refund, baseRequest({ input: { paymentId: "pay_1", amount: 10 } }));
    const conflicting = await kaji.execute(
      refund,
      baseRequest({ input: { paymentId: "pay_1", amount: 999 } }),
    );

    expect(conflicting.status).toBe("failed");
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("an unknown existing outcome does not execute again", async () => {
    const store = memoryStore();
    const execute = vi
      .fn<(input: Refund) => Promise<Refund>>()
      .mockRejectedValueOnce(new Error("side effect ambiguous"));
    const refund = capability({
      name: "payments.refund",
      input: refundParser,
      authorize: () => true,
      execute,
    });
    const kaji = createKaji({ store });

    const first = await kaji.execute(refund, baseRequest());
    expect(first.status).toBe("unknown");

    const second = await kaji.execute(refund, baseRequest());

    expect(second.status).toBe("unknown");
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("repeated execution with the same completed key remains deterministic", async () => {
    const store = memoryStore();
    const execute = vi.fn(async (input: Refund) => ({ refunded: input.amount }));
    const refund = capability({
      name: "payments.refund",
      input: refundParser,
      authorize: () => true,
      execute,
    });
    const kaji = createKaji({ store });

    const results = await Promise.all(
      Array.from({ length: 5 }, () => kaji.execute(refund, baseRequest())),
    );

    expect(execute).toHaveBeenCalledTimes(1);
    for (const result of results) {
      expect(result.status).toBe("succeeded");
    }
  });
});

describe("concurrency integration", () => {
  it("runs the capability exactly once for many concurrent identical requests", async () => {
    const store = memoryStore();
    const execute = vi.fn(async (input: Refund) => ({ refunded: input.amount }));
    const refund = capability({
      name: "payments.refund",
      input: refundParser,
      authorize: () => true,
      execute,
    });
    const kaji = createKaji({ store });

    const results = await Promise.all(
      Array.from({ length: 25 }, () => kaji.execute(refund, baseRequest())),
    );

    expect(execute).toHaveBeenCalledTimes(1);
    expect(results.every((result) => result.status === "succeeded")).toBe(true);
  });
});
