import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { capability } from "../src/capability.ts";
import { createKaji } from "../src/kaji.ts";
import { memoryStore } from "../src/memory-store.ts";
import { baseRequest, refundParser, type Refund } from "./execution-fixtures.ts";

describe("cancellation before execution", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("a pre-aborted signal prevents the store claim and execution", async () => {
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
    expect(claimSpy).toHaveBeenCalledTimes(0);
    expect(execute).toHaveBeenCalledTimes(0);
  });

  it("cancellation during authorization prevents approval and execution", async () => {
    const controller = new AbortController();
    const approval = vi.fn(() => true);
    const execute = vi.fn();
    const refund = capability({
      name: "payments.refund",
      input: refundParser,
      authorize: () => {
        controller.abort();
        return true;
      },
      approval,
      execute,
    });
    const kaji = createKaji({ store: memoryStore() });

    const result = await kaji.execute(refund, baseRequest({ signal: controller.signal }));

    expect(result.status).toBe("cancelled");
    expect(approval).toHaveBeenCalledTimes(0);
    expect(execute).toHaveBeenCalledTimes(0);
  });

  it("cancellation during approval prevents the store claim and execution", async () => {
    const controller = new AbortController();
    const execute = vi.fn();
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
    const kaji = createKaji({ store: memoryStore(), approve: async () => ({ approved: true }) });

    const result = await kaji.execute(refund, baseRequest({ signal: controller.signal }));

    expect(result.status).toBe("cancelled");
    expect(execute).toHaveBeenCalledTimes(0);
  });

  it("a timeout before execution begins prevents the capability from running", async () => {
    const execute = vi.fn();
    const refund = capability({
      name: "payments.refund",
      input: refundParser,
      authorize: () => {
        vi.advanceTimersByTime(10);
        return true;
      },
      execute,
    });
    const kaji = createKaji({ store: memoryStore(), timeoutMs: 5 });

    const result = await kaji.execute(refund, baseRequest());

    expect(result.status).toBe("cancelled");
    expect(execute).toHaveBeenCalledTimes(0);
  });
});

describe("cancellation after execution begins", () => {
  it("does not imply rollback; it settles unknown", async () => {
    const controller = new AbortController();
    let executionStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      executionStarted = resolve;
    });
    const execute = vi.fn(async (input: Refund, context: { signal: AbortSignal }) => {
      executionStarted();
      return await new Promise<Refund>((_, reject) => {
        context.signal.addEventListener("abort", () => reject(new Error("aborted mid-flight")));
      });
    });
    const refund = capability({
      name: "payments.refund",
      input: refundParser,
      authorize: () => true,
      execute,
    });
    const kaji = createKaji({ store: memoryStore() });

    const pending = kaji.execute(refund, baseRequest({ signal: controller.signal }));
    await started;
    controller.abort();
    const result = await pending;

    expect(result.status).toBe("unknown");
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("does not retry after a post-start cancellation settles unknown", async () => {
    const controller = new AbortController();
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
    const refund = capability({
      name: "payments.refund",
      input: refundParser,
      authorize: () => true,
      execute,
    });
    const kaji = createKaji({ store: memoryStore() });

    const pending = kaji.execute(refund, baseRequest({ signal: controller.signal }));
    await started;
    controller.abort();
    await pending;

    expect(execute).toHaveBeenCalledTimes(1);
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
});

describe("timeout after execution begins", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("does not imply rollback; it settles unknown", async () => {
    const execute = vi.fn(async (input: Refund, context: { signal: AbortSignal }) => {
      return await new Promise<Refund>((_, reject) => {
        context.signal.addEventListener("abort", () => reject(new Error("timed out mid-flight")));
      });
    });
    const refund = capability({
      name: "payments.refund",
      input: refundParser,
      authorize: () => true,
      execute,
    });
    const kaji = createKaji({ store: memoryStore(), timeoutMs: 5 });

    const pending = kaji.execute(refund, baseRequest());
    await vi.advanceTimersByTimeAsync(5);
    const result = await pending;

    expect(result.status).toBe("unknown");
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("preserves store state so a duplicate does not execute again after timeout", async () => {
    const store = memoryStore();
    const execute = vi.fn(async (input: Refund, context: { signal: AbortSignal }) => {
      return await new Promise<Refund>((_, reject) => {
        context.signal.addEventListener("abort", () => reject(new Error("timed out")));
      });
    });
    const refund = capability({
      name: "payments.refund",
      input: refundParser,
      authorize: () => true,
      execute,
    });
    const kaji = createKaji({ store, timeoutMs: 5 });

    const pending = kaji.execute(refund, baseRequest());
    await vi.advanceTimersByTimeAsync(5);
    await pending;

    const second = await kaji.execute(refund, baseRequest());

    expect(second.status).toBe("unknown");
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("cleans up its timeout timer after completion", async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    const refund = capability({
      name: "payments.refund",
      input: refundParser,
      authorize: () => true,
      execute: async (input) => input,
    });
    const kaji = createKaji({ store: memoryStore(), timeoutMs: 1000 });

    await kaji.execute(refund, baseRequest());

    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
  });
});
