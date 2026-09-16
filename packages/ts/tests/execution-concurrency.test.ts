import { describe, expect, it, vi } from "vitest";
import { capability } from "../src/capability.ts";
import { createKaji } from "../src/kaji.ts";
import { memoryStore } from "../src/memory-store.ts";
import { baseRequest, refundParser, type Refund } from "./execution-fixtures.ts";

describe("concurrent identical requests", () => {
  it("begins the capability body exactly once for many concurrent calls", async () => {
    const execute = vi.fn(async (input: Refund) => ({ refunded: input.amount }));
    const refund = capability({
      name: "payments.refund",
      input: refundParser,
      authorize: () => true,
      execute,
    });
    const kaji = createKaji({ store: memoryStore() });

    const results = await Promise.all(
      Array.from({ length: 25 }, () => kaji.execute(refund, baseRequest())),
    );

    expect(execute).toHaveBeenCalledTimes(1);
    expect(results.every((result) => result.status === "succeeded")).toBe(true);
  });

  it("returns the same recorded outcome to every concurrent caller", async () => {
    const execute = vi.fn(async (input: Refund) => ({ refunded: input.amount }));
    const refund = capability({
      name: "payments.refund",
      input: refundParser,
      authorize: () => true,
      execute,
    });
    const kaji = createKaji({ store: memoryStore() });

    const [first, ...rest] = await Promise.all(
      Array.from({ length: 10 }, () => kaji.execute(refund, baseRequest())),
    );

    for (const result of rest) {
      expect(result).toEqual(first);
    }
  });

  it("does not duplicate an ambiguous side effect under concurrency", async () => {
    let commitCount = 0;
    const execute = vi.fn(async () => {
      commitCount += 1;
      throw new Error("connection lost after committing");
    });
    const refund = capability({
      name: "payments.refund",
      input: refundParser,
      authorize: () => true,
      execute,
    });
    const kaji = createKaji({ store: memoryStore() });

    const results = await Promise.all(
      Array.from({ length: 15 }, () => kaji.execute(refund, baseRequest())),
    );

    expect(commitCount).toBe(1);
    expect(results.every((result) => result.status === "unknown")).toBe(true);
  });
});

describe("concurrent conflicting requests", () => {
  it("lets only the original input execute; conflicting input never executes", async () => {
    const execute = vi.fn(async (input: Refund) => ({ refunded: input.amount }));
    const refund = capability({
      name: "payments.refund",
      input: refundParser,
      authorize: () => true,
      execute,
    });
    const kaji = createKaji({ store: memoryStore() });

    const results = await Promise.all([
      kaji.execute(refund, baseRequest({ input: { paymentId: "pay_1", amount: 10 } })),
      kaji.execute(refund, baseRequest({ input: { paymentId: "pay_1", amount: 20 } })),
      kaji.execute(refund, baseRequest({ input: { paymentId: "pay_1", amount: 30 } })),
    ]);

    expect(execute).toHaveBeenCalledTimes(1);
    const statuses = results.map((result) => result.status).sort();
    // Exactly one request claims the identity and executes; the other two
    // observe a fingerprint conflict against whichever claimed first.
    expect(statuses.filter((status) => status === "succeeded")).toHaveLength(1);
    expect(statuses.filter((status) => status === "failed")).toHaveLength(2);
  });
});
