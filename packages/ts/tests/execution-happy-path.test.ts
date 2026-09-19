import { describe, expect, it, vi } from "vitest";
import { capability } from "../src/capability.ts";
import { createKaji } from "../src/kaji.ts";
import { memoryStore } from "../src/memory-store.ts";
import { baseRequest, refundParser, type Refund } from "./execution-fixtures.ts";

describe("kaji.execute happy path", () => {
  it("runs a valid request successfully", async () => {
    const kaji = createKaji({ store: memoryStore() });
    const refund = capability({
      name: "payments.refund",
      input: refundParser,
      authorize: () => true,
      execute: async (input) => ({ refunded: input.amount }),
    });

    const result = await kaji.execute(refund, baseRequest());

    expect(result.status).toBe("succeeded");
    if (result.status === "succeeded") {
      expect(result.result).toEqual({ refunded: 10 });
      expect(result.evidence.capability).toBe("payments.refund");
      expect(result.evidence.principalId).toBe("user_1");
      expect(result.evidence.idempotencyKey).toBe("key_1");
      expect(typeof result.evidence.executionId).toBe("string");
      expect(result.evidence.executionId.length).toBeGreaterThan(0);
    }
  });

  it("passes the schema's transformed output to authorize, approval, and execute", async () => {
    const seen: Refund[] = [];
    const refund = capability({
      name: "payments.refund",
      input: refundParser,
      authorize: ({ input }) => {
        seen.push(input);
        return true;
      },
      approval: ({ input }) => {
        seen.push(input);
        return false;
      },
      execute: async (input) => {
        seen.push(input);
        return input;
      },
    });
    const kaji = createKaji({ store: memoryStore() });

    await kaji.execute(refund, baseRequest());

    expect(seen).toEqual([
      { paymentId: "pay_1", amount: 10 },
      { paymentId: "pay_1", amount: 10 },
      { paymentId: "pay_1", amount: 10 },
    ]);
  });

  it("runs authorization", async () => {
    const authorize = vi.fn(() => true);
    const refund = capability({
      name: "payments.refund",
      input: refundParser,
      authorize,
      execute: async (input) => input,
    });
    const kaji = createKaji({ store: memoryStore() });

    await kaji.execute(refund, baseRequest());

    expect(authorize).toHaveBeenCalledTimes(1);
    expect(authorize).toHaveBeenCalledWith({
      principalId: "user_1",
      input: { paymentId: "pay_1", amount: 10 },
    });
  });

  it("runs approval and the approve handler when approval is required", async () => {
    const approve = vi.fn(async () => ({ approved: true }));
    const refund = capability({
      name: "payments.refund",
      input: refundParser,
      authorize: () => true,
      approval: ({ input }) => input.amount >= 5,
      execute: async (input) => input,
    });
    const kaji = createKaji({ store: memoryStore(), approve });

    const result = await kaji.execute(refund, baseRequest());

    expect(approve).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("succeeded");
  });

  it("claims the store before authorization and executes exactly once", async () => {
    const store = memoryStore();
    const claimSpy = vi.spyOn(store, "claim");
    const authorize = vi.fn(() => true);
    const execute = vi.fn(async (input: Refund) => input);
    const refund = capability({ name: "payments.refund", input: refundParser, authorize, execute });
    const kaji = createKaji({ store });

    await kaji.execute(refund, baseRequest());

    expect(claimSpy).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("returns replayed: false is not part of the frozen result; fresh results carry no replay flag", async () => {
    const refund = capability({
      name: "payments.refund",
      input: refundParser,
      authorize: () => true,
      execute: async (input) => input,
    });
    const kaji = createKaji({ store: memoryStore() });

    const result = await kaji.execute(refund, baseRequest());

    expect(result).not.toHaveProperty("replayed");
  });

  it("builds ExecutionContext with exactly principalId, idempotencyKey, and signal", async () => {
    let seenContext: unknown;
    const refund = capability({
      name: "payments.refund",
      input: refundParser,
      authorize: () => true,
      execute: async (input, context) => {
        seenContext = context;
        return input;
      },
    });
    const kaji = createKaji({ store: memoryStore() });

    await kaji.execute(refund, baseRequest());

    expect(seenContext).toMatchObject({ principalId: "user_1", idempotencyKey: "key_1" });
    expect((seenContext as { signal: unknown }).signal).toBeInstanceOf(AbortSignal);
    expect(Object.keys(seenContext as object).sort()).toEqual([
      "idempotencyKey",
      "principalId",
      "signal",
    ]);
  });

  it("preserves the capability's result type", async () => {
    const refund = capability({
      name: "payments.refund",
      input: refundParser,
      authorize: () => true,
      execute: async (input) => ({ refunded: input.amount, at: "now" }),
    });
    const kaji = createKaji({ store: memoryStore() });

    const result = await kaji.execute(refund, baseRequest());

    if (result.status === "succeeded") {
      expect(result.result.refunded).toBe(10);
      expect(result.result.at).toBe("now");
    }
  });
});
