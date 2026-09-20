import { describe, expect, expectTypeOf, it, vi } from "vitest";
import * as v from "valibot";
import { capability } from "../src/capability.ts";
import {
  InvalidInputError,
  validateInput,
  type StandardSchemaIssue,
  type StandardSchemaResult,
  type StandardSchemaV1,
} from "../src/schema.ts";

type Refund = { paymentId: string; amount: number };

function issue(message: string, path?: StandardSchemaIssue["path"]): StandardSchemaIssue {
  return path === undefined ? { message } : { message, path };
}

/**
 * Hand-written Standard Schema fixture factory. The fixture has no
 * `.parse()` method, no vendor APIs, and no Kaji involvement — protocol
 * behavior is tested against the spec's shape alone.
 */
function schema<Output>(
  validate: (
    value: unknown,
  ) => StandardSchemaResult<Output> | Promise<StandardSchemaResult<Output>>,
): StandardSchemaV1<unknown, Output> {
  return { "~standard": { version: 1, vendor: "test", validate } };
}

describe("validateInput (Standard Schema protocol)", () => {
  it("returns the value of a synchronous successful validation", async () => {
    const output = await validateInput(
      schema<Refund>(() => ({ value: { paymentId: "pay_1", amount: 10 } })),
      {},
    );
    expect(output).toEqual({ paymentId: "pay_1", amount: 10 });
  });

  it("awaits an asynchronous successful validation", async () => {
    const output = await validateInput(
      schema<Refund>(async (value) => ({ value: value as Refund })),
      { paymentId: "pay_1", amount: 10 },
    );
    expect(output).toEqual({ paymentId: "pay_1", amount: 10 });
  });

  it("throws InvalidInputError preserving structured issues on synchronous failure", async () => {
    const error = await validateInput(
      schema<Refund>(() => ({
        issues: [issue("Expected string", ["paymentId"]), issue("Expected number", ["amount"])],
      })),
      {},
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(InvalidInputError);
    expect(error).toBeInstanceOf(Error);
    const invalid = error as InvalidInputError;
    expect(invalid.issues).toEqual([
      { message: "Expected string", path: ["paymentId"] },
      { message: "Expected number", path: ["amount"] },
    ]);
    expect(invalid.message).toContain("paymentId: Expected string");
    expect(invalid.message).toContain("amount: Expected number");
  });

  it("throws InvalidInputError on asynchronous failure", async () => {
    const error = await validateInput(
      schema<Refund>(async () => ({ issues: [issue("denied by remote validation")] })),
      {},
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(InvalidInputError);
    expect((error as InvalidInputError).issues).toEqual([
      { message: "denied by remote validation" },
    ]);
  });

  it("returns the transformed output, not the raw input", async () => {
    const amount: StandardSchemaV1<string, number> = {
      "~standard": {
        version: 1,
        vendor: "test",
        validate: (value) => ({ value: Number(value) }),
        types: { input: null as unknown as string, output: null as unknown as number },
      },
    };

    expect(await validateInput(amount, "750")).toBe(750);
    expectTypeOf(await validateInput(amount, "750")).toEqualTypeOf<number>();
  });

  it("preserves multiple issues in order", async () => {
    const error = await validateInput(
      schema<Refund>(() => ({
        issues: [issue("first"), issue("second"), issue("third")],
      })),
      {},
    ).catch((caught: unknown) => caught);

    expect((error as InvalidInputError).issues.map((i) => i.message)).toEqual([
      "first",
      "second",
      "third",
    ]);
  });

  it("preserves issue paths, including PathSegment objects", async () => {
    const error = await validateInput(
      schema<Refund>(() => ({
        issues: [
          issue("Required", [{ key: "paymentId" }]),
          issue("Invalid", ["amount", { key: 2 }]),
        ],
      })),
      {},
    ).catch((caught: unknown) => caught);

    const issues = (error as InvalidInputError).issues;
    expect(issues[0]?.path).toEqual([{ key: "paymentId" }]);
    expect(issues[1]?.path).toEqual(["amount", { key: 2 }]);
    expect((error as InvalidInputError).message).toContain("paymentId: Required");
    expect((error as InvalidInputError).message).toContain("amount.2: Invalid");
  });

  it("passes the raw request input to validate unchanged", async () => {
    const raw = { nested: { value: [1, 2, 3] } };
    let received: unknown;
    await validateInput(
      schema<unknown>((value) => {
        received = value;
        return { value };
      }),
      raw,
    );
    expect(received).toBe(raw);
  });

  it("treats an issues array as failure even when a value is also present", async () => {
    const error = await validateInput(
      schema<Refund>(() => ({ value: { paymentId: "pay_1", amount: 10 }, issues: [issue("bad")] })),
      {},
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(InvalidInputError);
  });

  it("rejects a schema whose validate throws by propagating that error", async () => {
    await expect(
      validateInput(
        schema<Refund>(() => {
          throw new Error("vendor validate exploded");
        }),
        {},
      ),
    ).rejects.toThrow("vendor validate exploded");
  });
});

describe("capability() construction (Standard Schema)", () => {
  const authorize = () => true;

  it("accepts a hand-written Standard Schema with extra fields", () => {
    const schemaWithExtras = {
      "~standard": {
        version: 1 as const,
        vendor: "test",
        validate: (value: unknown) => ({ value }),
      },
      extraVendorField: true,
    };

    const refund = capability({
      name: "payments.refund",
      input: schemaWithExtras,
      authorize,
      execute: async (input) => input,
    });
    expect(refund.name).toBe("payments.refund");
  });

  it("rejects a parse-only object with no Standard Schema property", () => {
    expect(() =>
      capability({
        name: "payments.refund",
        // A `.parse()`-only object is not a supported Kaji schema.
        // @ts-expect-error missing "~standard"
        input: { parse: (value: unknown) => value },
        authorize,
        execute: async (input) => input,
      }),
    ).toThrow(/~standard/);
  });

  it("rejects a Standard Schema with a future protocol version", () => {
    expect(() =>
      capability({
        name: "payments.refund",
        // @ts-expect-error version must be 1
        input: { "~standard": { version: 2, vendor: "test", validate: () => ({ value: null }) } },
        authorize,
        execute: async (input) => input,
      }),
    ).toThrow(/version 1/);
  });

  it("rejects a Standard Schema whose validate is not a function", () => {
    expect(() =>
      capability({
        name: "payments.refund",
        // @ts-expect-error validate must be a function
        input: { "~standard": { version: 1, vendor: "test", validate: "nope" } },
        authorize,
        execute: async (input) => input,
      }),
    ).toThrow(/validate/);
  });

  it("accepts a callable schema carrying ~standard (the protocol requires the property, not object-ness)", () => {
    const callable: StandardSchemaV1 = Object.assign(() => {}, {
      "~standard": {
        version: 1 as const,
        vendor: "test",
        validate: (value: unknown) => ({ value }),
      },
    });
    const cap = capability({
      name: "payments.callable",
      input: callable,
      authorize: () => true,
      execute: () => true,
    });
    expect(cap.name).toBe("payments.callable");
  });

  it("never invokes validation during construction", () => {
    let validateCalled = false;
    capability({
      name: "payments.refund",
      input: {
        "~standard": {
          version: 1 as const,
          vendor: "test",
          validate: (value: unknown) => {
            validateCalled = true;
            return { value };
          },
        },
      },
      authorize,
      execute: async (input) => input,
    });
    expect(validateCalled).toBe(false);
  });
});

describe("Standard Schema interoperability (Valibot)", () => {
  const Amount = v.pipe(v.string(), v.transform(Number), v.number());

  it("accepts a Valibot schema directly, with transformed output inferred", () => {
    const charge = capability({
      name: "payments.charge",
      input: Amount,
      authorize: ({ input }) => {
        expectTypeOf(input).toEqualTypeOf<number>();
        return input > 0;
      },
      approval: ({ input }) => input >= 500,
      execute: async (input) => {
        expectTypeOf(input).toEqualTypeOf<number>();
        return { charged: input };
      },
    });

    expect(charge.name).toBe("payments.charge");
  });

  it("executes with the transformed Valibot output at runtime", async () => {
    const charge = capability({
      name: "payments.charge",
      input: Amount,
      authorize: () => true,
      execute: async (input) => ({ charged: input }),
    });
    const { createKaji } = await import("../src/kaji.ts");
    const { memoryStore } = await import("../src/store/memory.ts");
    const kaji = createKaji({ store: memoryStore() });

    const result = await kaji.execute(charge, {
      input: "750",
      principalId: "user_1",
      idempotencyKey: "key_1",
    });

    expect(result).toMatchObject({ status: "succeeded", result: { charged: 750 } });
  });

  it("rejects invalid Valibot input with preserved issues and no execution", async () => {
    const execute = vi.fn();
    const charge = capability({
      name: "payments.charge",
      input: Amount,
      authorize: () => true,
      execute,
    });
    const { createKaji } = await import("../src/kaji.ts");
    const { memoryStore } = await import("../src/store/memory.ts");
    const kaji = createKaji({ store: memoryStore() });

    const error = await kaji
      .execute(charge, { input: true, principalId: "user_1", idempotencyKey: "key_1" })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(InvalidInputError);
    expect((error as InvalidInputError).issues.length).toBeGreaterThan(0);
    expect(execute).not.toHaveBeenCalled();
  });
});
