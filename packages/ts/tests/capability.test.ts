import { describe, expect, it } from "vitest";
import { capability } from "../src/capability.ts";
import type { InputParser } from "../src/schema.ts";

type Refund = { paymentId: string; amount: number };

const refundParser: InputParser<Refund> = {
  parse: (value) => value as Refund,
};

const authorize = async () => true;

describe("capability", () => {
  it("accepts a valid definition", () => {
    const refund = capability({
      name: "payments.refund",
      input: refundParser,
      authorize,
      execute: async (input) => input,
    });

    expect(refund.name).toBe("payments.refund");
  });

  it("rejects an empty name", () => {
    expect(() =>
      capability({
        name: "",
        input: refundParser,
        authorize,
        execute: async (input) => input,
      }),
    ).toThrow(/non-empty name/);
  });

  it("rejects a whitespace-only name", () => {
    expect(() =>
      capability({
        name: "   ",
        input: refundParser,
        authorize,
        execute: async (input) => input,
      }),
    ).toThrow(/non-empty name/);
  });

  it("rejects a missing authorize function", () => {
    expect(() =>
      capability({
        name: "payments.refund",
        input: refundParser,
        // @ts-expect-error authorize is required
        authorize: undefined,
        execute: async (input) => input,
      }),
    ).toThrow(/authorize/);
  });

  it("preserves the original name exactly", () => {
    const refund = capability({
      name: "payments.refund",
      input: refundParser,
      authorize,
      execute: async (input) => input,
    });

    expect(refund.name).toBe("payments.refund");
  });

  it("stores hooks without invoking them during construction", () => {
    let authorizeCalled = false;
    let approvalCalled = false;
    let executeCalled = false;

    capability({
      name: "payments.refund",
      input: refundParser,
      authorize: async () => {
        authorizeCalled = true;
        return true;
      },
      approval: () => {
        approvalCalled = true;
        return false;
      },
      execute: async (input) => {
        executeCalled = true;
        return input;
      },
    });

    expect(authorizeCalled).toBe(false);
    expect(approvalCalled).toBe(false);
    expect(executeCalled).toBe(false);
  });

  it("cannot be mutated after construction", () => {
    const refund = capability({
      name: "payments.refund",
      input: refundParser,
      authorize,
      execute: async (input) => input,
    });

    expect(() => {
      // @ts-expect-error name is readonly and the object is frozen
      refund.name = "payments.other";
    }).toThrow(TypeError);
    expect(refund.name).toBe("payments.refund");
  });
});
