import { describe, expect, it, vi } from "vitest";
import { capability } from "../src/capability.ts";
import { createKaji } from "../src/kaji.ts";
import { knownFailure } from "../src/errors.ts";
import { memoryStore } from "../src/store/memory.ts";
import type { ExecutionStore } from "../src/store/store.ts";
import { baseRequest, refundSchema, type Refund } from "./execution-fixtures.ts";

describe("invalid request metadata", () => {
  it("rejects an empty principalId before validation, claim, authorization, or execution", async () => {
    const execute = vi.fn();
    const refund = capability({
      name: "payments.refund",
      input: refundSchema,
      authorize: vi.fn(),
      execute,
    });
    const kaji = createKaji({ store: memoryStore() });

    await expect(kaji.execute(refund, baseRequest({ principalId: "" }))).rejects.toThrow(
      /principalId/,
    );
    expect(execute).toHaveBeenCalledTimes(0);
  });

  it("rejects a whitespace-only idempotencyKey", async () => {
    const execute = vi.fn();
    const refund = capability({
      name: "payments.refund",
      input: refundSchema,
      authorize: () => true,
      execute,
    });
    const kaji = createKaji({ store: memoryStore() });

    await expect(kaji.execute(refund, baseRequest({ idempotencyKey: "   " }))).rejects.toThrow(
      /idempotencyKey/,
    );
    expect(execute).toHaveBeenCalledTimes(0);
  });
});

describe("invalid capability input", () => {
  it("prevents authorization, approval, claim, and execution", async () => {
    const store = memoryStore();
    const claimSpy = vi.spyOn(store, "claim");
    const authorize = vi.fn(() => true);
    const approval = vi.fn(() => false);
    const execute = vi.fn();
    const refund = capability({
      name: "payments.refund",
      input: refundSchema,
      authorize,
      approval,
      execute,
    });
    const kaji = createKaji({ store });

    await expect(
      kaji.execute(refund, baseRequest({ input: { paymentId: "pay_1" } })),
    ).rejects.toThrow("invalid refund input");
    expect(authorize).toHaveBeenCalledTimes(0);
    expect(approval).toHaveBeenCalledTimes(0);
    expect(claimSpy).toHaveBeenCalledTimes(0);
    expect(execute).toHaveBeenCalledTimes(0);
  });
});

describe("authorization", () => {
  it("denies and prevents approval and execution when authorize() returns false", async () => {
    const approval = vi.fn(() => true);
    const execute = vi.fn();
    const refund = capability({
      name: "payments.refund",
      input: refundSchema,
      authorize: () => false,
      approval,
      execute,
    });
    const kaji = createKaji({ store: memoryStore() });

    const result = await kaji.execute(refund, baseRequest());

    expect(result.status).toBe("denied");
    expect(approval).toHaveBeenCalledTimes(0);
    expect(execute).toHaveBeenCalledTimes(0);
  });

  it("fails closed and preserves the cause when authorize() throws", async () => {
    const cause = new Error("authorize exploded");
    const execute = vi.fn();
    const refund = capability({
      name: "payments.refund",
      input: refundSchema,
      authorize: () => {
        throw cause;
      },
      execute,
    });
    const kaji = createKaji({ store: memoryStore() });

    const result = await kaji.execute(refund, baseRequest());

    expect(result.status).toBe("denied");
    if (result.status === "denied") expect(result.error).toBe(cause);
    expect(execute).toHaveBeenCalledTimes(0);
  });
});

describe("approval", () => {
  it("does not call the approve handler when approval is not required", async () => {
    const approve = vi.fn();
    const execute = vi.fn(async (input: Refund) => input);
    const refund = capability({
      name: "payments.refund",
      input: refundSchema,
      authorize: () => true,
      approval: () => false,
      execute,
    });
    const kaji = createKaji({ store: memoryStore(), approve });

    const result = await kaji.execute(refund, baseRequest());

    expect(approve).toHaveBeenCalledTimes(0);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("succeeded");
  });

  it("executes exactly once when approval is required and approved", async () => {
    const approve = vi.fn(async () => ({ approved: true }));
    const execute = vi.fn(async (input: Refund) => input);
    const refund = capability({
      name: "payments.refund",
      input: refundSchema,
      authorize: () => true,
      approval: () => true,
      execute,
    });
    const kaji = createKaji({ store: memoryStore(), approve });

    const result = await kaji.execute(refund, baseRequest());

    expect(approve).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("succeeded");
  });

  it("prevents execution when approval is required and rejected", async () => {
    const execute = vi.fn();
    const refund = capability({
      name: "payments.refund",
      input: refundSchema,
      authorize: () => true,
      approval: () => true,
      execute,
    });
    const kaji = createKaji({ store: memoryStore(), approve: async () => ({ approved: false }) });

    const result = await kaji.execute(refund, baseRequest());

    expect(result.status).toBe("rejected");
    expect(execute).toHaveBeenCalledTimes(0);
  });

  it("prevents execution when approval is required and no approve handler is configured", async () => {
    const execute = vi.fn();
    const refund = capability({
      name: "payments.refund",
      input: refundSchema,
      authorize: () => true,
      approval: () => true,
      execute,
    });
    const kaji = createKaji({ store: memoryStore() });

    const result = await kaji.execute(refund, baseRequest());

    expect(result.status).toBe("rejected");
    expect(execute).toHaveBeenCalledTimes(0);
  });

  it("fails closed and preserves the cause when the approve handler throws", async () => {
    const cause = new Error("approve exploded");
    const execute = vi.fn();
    const refund = capability({
      name: "payments.refund",
      input: refundSchema,
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
    if (result.status === "rejected") expect(result.error).toBe(cause);
    expect(execute).toHaveBeenCalledTimes(0);
  });

  it("prevents execution when the approve handler returns a malformed decision", async () => {
    const execute = vi.fn();
    const refund = capability({
      name: "payments.refund",
      input: refundSchema,
      authorize: () => true,
      approval: () => true,
      execute,
    });
    const kaji = createKaji({
      store: memoryStore(),
      // @ts-expect-error deliberately malformed to test the fail-closed path
      approve: async () => ({ notApproved: true }),
    });

    const result = await kaji.execute(refund, baseRequest());

    expect(result.status).toBe("rejected");
    expect(execute).toHaveBeenCalledTimes(0);
  });
});

describe("store claim failure", () => {
  it("prevents execution and preserves the original cause", async () => {
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
      input: refundSchema,
      authorize: () => true,
      execute,
    });
    const kaji = createKaji({ store });

    await expect(kaji.execute(refund, baseRequest())).rejects.toMatchObject({ cause });
    expect(execute).toHaveBeenCalledTimes(0);
  });
});

describe("ordinary execution failure", () => {
  it("settles unknown, not failed, and preserves the thrown cause", async () => {
    const cause = new Error("refund provider rejected the card");
    const execute = vi.fn(async () => {
      throw cause;
    });
    const refund = capability({
      name: "payments.refund",
      input: refundSchema,
      authorize: () => true,
      execute,
    });
    const kaji = createKaji({ store: memoryStore() });

    const result = await kaji.execute(refund, baseRequest());

    // Only application code knows whether its own side effect committed
    // before the error surfaced, so an ordinary thrown error is still
    // ambiguous to Kaji and must not be presented as a definite failure.
    expect(result.status).toBe("unknown");
    if (result.status === "unknown") expect(result.error).toBe(cause);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("does not automatically retry after an ordinary thrown error", async () => {
    const execute = vi.fn().mockRejectedValue(new Error("ordinary failure"));
    const refund = capability({
      name: "payments.refund",
      input: refundSchema,
      authorize: () => true,
      execute,
    });
    const kaji = createKaji({ store: memoryStore() });

    await kaji.execute(refund, baseRequest());
    await kaji.execute(refund, baseRequest());

    expect(execute).toHaveBeenCalledTimes(1);
  });
});

describe("known failure", () => {
  it("settles failed, not unknown, when execute() throws knownFailure(cause)", async () => {
    const cause = new Error("card definitively declined before any charge was attempted");
    const execute = vi.fn(async () => {
      throw knownFailure(cause);
    });
    const refund = capability({
      name: "payments.refund",
      input: refundSchema,
      authorize: () => true,
      execute,
    });
    const kaji = createKaji({ store: memoryStore() });

    const result = await kaji.execute(refund, baseRequest());

    // Application code proved no side effect committed, so Kaji may
    // record this as an ordinary failure instead of the unknown default.
    expect(result.status).toBe("failed");
    if (result.status === "failed") expect(result.error).toBe(cause);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("does not misclassify a generic throw as known failure", async () => {
    const cause = new Error("acknowledgement lost after the provider may have committed");
    const execute = vi.fn(async () => {
      throw cause;
    });
    const refund = capability({
      name: "payments.refund",
      input: refundSchema,
      authorize: () => true,
      execute,
    });
    const kaji = createKaji({ store: memoryStore() });

    const result = await kaji.execute(refund, baseRequest());

    // Kaji never infers a known failure from an error's class, message,
    // or status code — only an explicit knownFailure() throw qualifies.
    expect(result.status).toBe("unknown");
    if (result.status === "unknown") expect(result.error).toBe(cause);
  });

  it("does not automatically retry after a known failure", async () => {
    const execute = vi.fn(async () => {
      throw knownFailure(new Error("declined"));
    });
    const refund = capability({
      name: "payments.refund",
      input: refundSchema,
      authorize: () => true,
      execute,
    });
    const kaji = createKaji({ store: memoryStore() });

    await kaji.execute(refund, baseRequest());
    await kaji.execute(refund, baseRequest());

    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("does not re-execute an unknown outcome on a repeated request", async () => {
    const execute = vi.fn(async () => {
      throw new Error("acknowledgement lost");
    });
    const refund = capability({
      name: "payments.refund",
      input: refundSchema,
      authorize: () => true,
      execute,
    });
    const kaji = createKaji({ store: memoryStore() });

    const first = await kaji.execute(refund, baseRequest());
    const second = await kaji.execute(refund, baseRequest());

    expect(first.status).toBe("unknown");
    expect(second.status).toBe("unknown");
    expect(execute).toHaveBeenCalledTimes(1);
  });
});

describe("settlement failure after a real side effect", () => {
  it("does not report safe success when the store cannot durably record completion", async () => {
    const memory = memoryStore();
    const settlementCause = new Error("record unavailable");
    const store: ExecutionStore = {
      claim: (claim) => memory.claim(claim),
      record: vi.fn(async () => {
        throw settlementCause;
      }),
    };
    const execute = vi.fn(async (input: Refund) => ({ refunded: input.amount }));
    const refund = capability({
      name: "payments.refund",
      input: refundSchema,
      authorize: () => true,
      execute,
    });
    const kaji = createKaji({ store });

    const result = await kaji.execute(refund, baseRequest());

    expect(execute).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("unknown");
    if (result.status === "unknown") expect(result.error).toBe(settlementCause);
  });
});

describe("execution ordering", () => {
  it("runs validate, claim, authorize, approval, execute, settle exactly once each, in order", async () => {
    const calls: string[] = [];
    const store = memoryStore();
    const instrumented: ExecutionStore = {
      claim: async (claim) => {
        calls.push("claim");
        return store.claim(claim);
      },
      record: async (execution) => {
        calls.push("settle");
        return store.record(execution);
      },
    };
    const refund = capability({
      name: "payments.refund",
      input: {
        "~standard": {
          version: 1 as const,
          vendor: "test",
          validate: (value: unknown) => {
            calls.push("validate");
            return { value: value as Refund };
          },
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

  it("prevents every later stage when authorization denies the request", async () => {
    const store = memoryStore();
    const recordSpy = vi.spyOn(store, "record");
    const approval = vi.fn(() => true);
    const execute = vi.fn();
    const refund = capability({
      name: "payments.refund",
      input: refundSchema,
      authorize: () => false,
      approval,
      execute,
    });
    const kaji = createKaji({ store });

    await kaji.execute(refund, baseRequest());

    expect(approval).toHaveBeenCalledTimes(0);
    expect(execute).toHaveBeenCalledTimes(0);
    // Denial still settles the claimed idempotency key so a retry with the
    // same key observes the same denial deterministically.
    expect(recordSpy).toHaveBeenCalledTimes(1);
  });

  it("prevents execution when approval is rejected", async () => {
    const store = memoryStore();
    const execute = vi.fn();
    const refund = capability({
      name: "payments.refund",
      input: refundSchema,
      authorize: () => true,
      approval: () => true,
      execute,
    });
    const kaji = createKaji({ store, approve: async () => ({ approved: false }) });

    await kaji.execute(refund, baseRequest());

    expect(execute).toHaveBeenCalledTimes(0);
  });
});

describe("async Standard Schema validation", () => {
  function deferredSchema(value: Refund) {
    let resolve!: (result: { value: Refund }) => void;
    const validate = vi.fn(
      () =>
        new Promise<{ value: Refund }>((res) => {
          resolve = res;
        }),
    );
    const finish = () => resolve({ value });
    return { validate, finish };
  }

  it("runs no later stage while async validation is pending, then continues in order", async () => {
    const calls: string[] = [];
    const store = memoryStore();
    const instrumented: ExecutionStore = {
      claim: async (claim) => {
        calls.push("claim");
        return store.claim(claim);
      },
      record: async (execution) => {
        calls.push("settle");
        return store.record(execution);
      },
    };
    const _authorize = vi.fn(() => true);
    const _approval = vi.fn(() => true);
    const _execute = vi.fn();
    const deferred = deferredSchema({ paymentId: "pay_1", amount: 10 });

    const refund = capability({
      name: "payments.refund",
      input: {
        "~standard": {
          version: 1 as const,
          vendor: "test",
          validate: (_value: unknown) => {
            calls.push("validate");
            return deferred.validate();
          },
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

    const pending = kaji.execute(refund, baseRequest());
    // Deterministic flush: let execute() reach the validation await.
    await Promise.resolve();
    await Promise.resolve();

    expect(deferred.validate).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(["validate"]);

    deferred.finish();
    await pending;

    expect(calls).toEqual(["validate", "claim", "authorize", "approval", "execute", "settle"]);
  });

  it("runs no later stage when async validation reports issues", async () => {
    const store = memoryStore();
    const claimSpy = vi.spyOn(store, "claim");
    const recordSpy = vi.spyOn(store, "record");
    const authorize = vi.fn(() => true);
    const approval = vi.fn(() => true);
    const execute = vi.fn();
    let settleValidation!: () => void;
    const validate = vi.fn(
      () =>
        new Promise<{ issues: [{ message: string }] }>((resolve) => {
          settleValidation = () => resolve({ issues: [{ message: "async invalid" }] });
        }),
    );

    const refund = capability({
      name: "payments.refund",
      input: {
        "~standard": {
          version: 1 as const,
          vendor: "test",
          validate: () => validate(),
        },
      },
      authorize,
      approval,
      execute,
    });
    const kaji = createKaji({ store });

    const pending = kaji.execute(refund, baseRequest());
    await Promise.resolve();
    await Promise.resolve();

    settleValidation();
    await expect(pending).rejects.toThrow("async invalid");

    expect(claimSpy).not.toHaveBeenCalled();
    expect(authorize).not.toHaveBeenCalled();
    expect(approval).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
    expect(recordSpy).not.toHaveBeenCalled();
  });
});
