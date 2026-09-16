import { describe, expect, it, vi } from "vitest";
import { capability } from "../src/capability.ts";
import { createKaji } from "../src/kaji.ts";
import { memoryStore } from "../src/memory-store.ts";
import type { InputParser } from "../src/schema.ts";

type Refund = { paymentId: string; amount: number };

const refundParser: InputParser<Refund> = {
  parse: (value) => {
    const input = value as Partial<Refund>;
    if (typeof input.paymentId !== "string" || typeof input.amount !== "number") {
      throw new Error("invalid refund input");
    }
    return { paymentId: input.paymentId, amount: input.amount };
  },
};

function baseRequest(overrides: Record<string, unknown> = {}) {
  return {
    input: { paymentId: "pay_1", amount: 10 },
    principalId: "user_1",
    idempotencyKey: "key_1",
    ...overrides,
  };
}

describe("pre-execution gates", () => {
  it("rejects an empty principalId before validation, authorization, or claim", async () => {
    const execute = vi.fn();
    const refund = capability({
      name: "payments.refund",
      input: refundParser,
      authorize: vi.fn(),
      execute,
    });
    const kaji = createKaji({ store: memoryStore() });

    await expect(kaji.execute(refund, baseRequest({ principalId: "" }))).rejects.toThrow(
      /principalId/,
    );
    expect(execute).not.toHaveBeenCalled();
  });

  it("rejects an empty idempotencyKey", async () => {
    const refund = capability({
      name: "payments.refund",
      input: refundParser,
      authorize: () => true,
      execute: vi.fn(),
    });
    const kaji = createKaji({ store: memoryStore() });

    await expect(kaji.execute(refund, baseRequest({ idempotencyKey: "" }))).rejects.toThrow(
      /idempotencyKey/,
    );
  });

  it("invalid schema input prevents authorization, approval, claim, and execute", async () => {
    const store = memoryStore();
    const claimSpy = vi.spyOn(store, "claim");
    const authorize = vi.fn(() => true);
    const approval = vi.fn(() => false);
    const execute = vi.fn();
    const refund = capability({
      name: "payments.refund",
      input: refundParser,
      authorize,
      approval,
      execute,
    });
    const kaji = createKaji({ store });

    await expect(
      kaji.execute(refund, baseRequest({ input: { paymentId: "pay_1" } })),
    ).rejects.toThrow("invalid refund input");
    expect(authorize).not.toHaveBeenCalled();
    expect(approval).not.toHaveBeenCalled();
    expect(claimSpy).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it("authorization returning false denies and prevents approval/execute", async () => {
    const approval = vi.fn(() => true);
    const execute = vi.fn();
    const refund = capability({
      name: "payments.refund",
      input: refundParser,
      authorize: () => false,
      approval,
      execute,
    });
    const kaji = createKaji({ store: memoryStore() });

    const result = await kaji.execute(refund, baseRequest());

    expect(result.status).toBe("denied");
    expect(approval).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it("authorization throwing fails closed and preserves the cause", async () => {
    const cause = new Error("authorize exploded");
    const execute = vi.fn();
    const refund = capability({
      name: "payments.refund",
      input: refundParser,
      authorize: () => {
        throw cause;
      },
      execute,
    });
    const kaji = createKaji({ store: memoryStore() });

    const result = await kaji.execute(refund, baseRequest());

    expect(result.status).toBe("denied");
    if (result.status === "denied") {
      expect(result.error).toBe(cause);
    }
    expect(execute).not.toHaveBeenCalled();
  });

  it("approval predicate returning false bypasses the approve handler entirely", async () => {
    const approve = vi.fn();
    const refund = capability({
      name: "payments.refund",
      input: refundParser,
      authorize: () => true,
      approval: () => false,
      execute: async (input) => input,
    });
    const kaji = createKaji({ store: memoryStore(), approve });

    const result = await kaji.execute(refund, baseRequest());

    expect(approve).not.toHaveBeenCalled();
    expect(result.status).toBe("succeeded");
  });

  it("approval required calls the approve handler exactly once", async () => {
    const approve = vi.fn(async () => ({ approved: true }));
    const refund = capability({
      name: "payments.refund",
      input: refundParser,
      authorize: () => true,
      approval: () => true,
      execute: async (input) => input,
    });
    const kaji = createKaji({ store: memoryStore(), approve });

    await kaji.execute(refund, baseRequest());

    expect(approve).toHaveBeenCalledTimes(1);
  });

  it("approval required with no approve handler fails closed", async () => {
    const execute = vi.fn();
    const refund = capability({
      name: "payments.refund",
      input: refundParser,
      authorize: () => true,
      approval: () => true,
      execute,
    });
    const kaji = createKaji({ store: memoryStore() });

    const result = await kaji.execute(refund, baseRequest());

    expect(result.status).toBe("rejected");
    expect(execute).not.toHaveBeenCalled();
  });

  it("rejected approval prevents execution", async () => {
    const execute = vi.fn();
    const refund = capability({
      name: "payments.refund",
      input: refundParser,
      authorize: () => true,
      approval: () => true,
      execute,
    });
    const kaji = createKaji({ store: memoryStore(), approve: async () => ({ approved: false }) });

    const result = await kaji.execute(refund, baseRequest());

    expect(result.status).toBe("rejected");
    expect(execute).not.toHaveBeenCalled();
  });

  it("approve handler throwing fails closed and preserves the cause", async () => {
    const cause = new Error("approve exploded");
    const execute = vi.fn();
    const refund = capability({
      name: "payments.refund",
      input: refundParser,
      authorize: () => true,
      approval: () => true,
      execute,
    });
    const kaji = createKaji({
      store: memoryStore(),
      approve: async () => {
        throw cause;
      },
    });

    const result = await kaji.execute(refund, baseRequest());

    expect(result.status).toBe("rejected");
    if (result.status === "rejected") {
      expect(result.error).toBe(cause);
    }
    expect(execute).not.toHaveBeenCalled();
  });

  it("a pre-aborted signal prevents claim and execution", async () => {
    const store = memoryStore();
    const claimSpy = vi.spyOn(store, "claim");
    const execute = vi.fn();
    const refund = capability({
      name: "payments.refund",
      input: refundParser,
      authorize: () => true,
      execute,
    });
    const kaji = createKaji({ store });
    const controller = new AbortController();
    controller.abort();

    const result = await kaji.execute(refund, baseRequest({ signal: controller.signal }));

    expect(result.status).toBe("cancelled");
    expect(claimSpy).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });
});
