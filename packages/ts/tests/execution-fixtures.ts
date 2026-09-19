import type { InputParser } from "../src/schema.ts";

export type Refund = { paymentId: string; amount: number };

export const refundParser: InputParser<Refund> = {
  parse: (value) => {
    const input = value as Partial<Refund>;
    if (typeof input.paymentId !== "string" || typeof input.amount !== "number") {
      throw new Error("invalid refund input");
    }
    return { paymentId: input.paymentId, amount: input.amount };
  },
};

export function baseRequest(overrides: Record<string, unknown> = {}) {
  return {
    input: { paymentId: "pay_1", amount: 10 },
    principalId: "user_1",
    idempotencyKey: "key_1",
    ...overrides,
  };
}
