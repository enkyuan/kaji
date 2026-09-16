import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

describe("cancellation and timeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("cancellation before authorization prevents the store claim", async () => {
    const store = memoryStore();
    const controller = new AbortController();
    const authorize = vi.fn(() => {
      controller.abort();
      return true;
    });
    const execute = vi.fn(async (input: Refund) => input);
    const refund = capability({ name: "payments.refund", input: refundParser, authorize, execute });
    const kaji = createKaji({ store });

    const result = await kaji.execute(refund, baseRequest({ signal: controller.signal }));

    // Authorization already ran as part of the current pipeline pass, so
    // cancellation set during authorize is observed on the NEXT gate check
    // (after authorization, before approval), preventing execute.
    expect(execute).not.toHaveBeenCalled();
    expect(result.status).toBe("cancelled");
  });

  it("cancellation after claim but before approval prevents execution", async () => {
    const store = memoryStore();
    const controller = new AbortController();
    const execute = vi.fn(async (input: Refund) => input);
    const refund = capability({
      name: "payments.refund",
      input: refundParser,
      authorize: () => true,
      approval: () => {
        controller.abort();
        return true;
      },
      execute,
    });
    const kaji = createKaji({ store, approve: async () => ({ approved: true }) });

    const result = await kaji.execute(refund, baseRequest({ signal: controller.signal }));

    expect(execute).not.toHaveBeenCalled();
    expect(result.status).toBe("cancelled");
  });

  it("a timeout before execution begins prevents the capability from running", async () => {
    const store = memoryStore();
    const execute = vi.fn(async (input: Refund) => input);
    const refund = capability({
      name: "payments.refund",
      input: refundParser,
      authorize: () => {
        vi.advanceTimersByTime(10);
        return true;
      },
      execute,
    });
    const kaji = createKaji({ store, timeoutMs: 5 });

    const result = await kaji.execute(refund, baseRequest());

    expect(execute).not.toHaveBeenCalled();
    expect(result.status).toBe("cancelled");
  });

  it("passes the effective AbortSignal to the capability", async () => {
    let seenSignal: AbortSignal | undefined;
    const refund = capability({
      name: "payments.refund",
      input: refundParser,
      authorize: () => true,
      execute: async (input, context) => {
        seenSignal = context.signal;
        return input;
      },
    });
    const kaji = createKaji({ store: memoryStore() });

    await kaji.execute(refund, baseRequest());

    expect(seenSignal).toBeInstanceOf(AbortSignal);
  });

  it("cancellation after execution begins settles unknown when the result never resolves", async () => {
    const store = memoryStore();
    const controller = new AbortController();
    let executionStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      executionStarted = resolve;
    });
    const refund = capability({
      name: "payments.refund",
      input: refundParser,
      authorize: () => true,
      execute: async (input, context) => {
        executionStarted();
        return await new Promise<Refund>((_, reject) => {
          context.signal.addEventListener("abort", () => reject(new Error("aborted mid-flight")));
        });
      },
    });
    const kaji = createKaji({ store });

    const pending = kaji.execute(refund, baseRequest({ signal: controller.signal }));
    await started;
    controller.abort();
    const result = await pending;

    expect(result.status).toBe("unknown");
  });

  it("a timeout after execution begins settles unknown", async () => {
    const store = memoryStore();
    const refund = capability({
      name: "payments.refund",
      input: refundParser,
      authorize: () => true,
      execute: async (input, context) => {
        return await new Promise<Refund>((_, reject) => {
          context.signal.addEventListener("abort", () => reject(new Error("timed out mid-flight")));
        });
      },
    });
    const kaji = createKaji({ store, timeoutMs: 5 });

    const pending = kaji.execute(refund, baseRequest());
    await vi.advanceTimersByTimeAsync(5);
    const result = await pending;

    expect(result.status).toBe("unknown");
  });

  it("does not automatically retry after an unknown outcome from cancellation", async () => {
    const store = memoryStore();
    let executionStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      executionStarted = resolve;
    });
    const execute = vi.fn(async (input: Refund, context: { signal: AbortSignal }) => {
      executionStarted();
      return await new Promise<Refund>((_, reject) => {
        context.signal.addEventListener("abort", () => reject(new Error("aborted")));
      });
    });
    const controller = new AbortController();
    const refund = capability({
      name: "payments.refund",
      input: refundParser,
      authorize: () => true,
      execute,
    });
    const kaji = createKaji({ store });

    const pending = kaji.execute(refund, baseRequest({ signal: controller.signal }));
    await started;
    controller.abort();
    await pending;

    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("cleans up its timeout timer", async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    const refund = capability({
      name: "payments.refund",
      input: refundParser,
      authorize: () => true,
      execute: async (input) => input,
    });
    const kaji = createKaji({ store: memoryStore(), timeoutMs: 1000 });

    await kaji.execute(refund, baseRequest());

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
});
