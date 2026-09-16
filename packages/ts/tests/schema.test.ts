import { describe, expect, it } from "vitest";
import { validateInput } from "../src/schema.ts";
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

describe("validateInput", () => {
  it("returns the parser's validated output", () => {
    const output = validateInput(refundParser, { paymentId: "pay_1", amount: 10 });
    expect(output).toEqual({ paymentId: "pay_1", amount: 10 });
  });

  it("propagates a parser's thrown error on invalid input", () => {
    expect(() => validateInput(refundParser, { paymentId: "pay_1" })).toThrow(
      "invalid refund input",
    );
  });

  it("preserves a parser's transformed output", () => {
    const trimming: InputParser<string> = {
      parse: (value) => String(value).trim(),
    };

    expect(validateInput(trimming, "  hi  ")).toBe("hi");
  });
});
