import type { StandardSchemaV1 } from "../src/schema.ts";

export type Refund = { paymentId: string; amount: number };

/**
 * Hand-written Standard Schema V1 fixture: identity validation for Refund.
 * Intentionally uses no validator library, so the execution suite tests the
 * protocol itself rather than any vendor's behavior.
 */
export const refundSchema: StandardSchemaV1<Refund, Refund> = {
  "~standard": {
    version: 1,
    vendor: "test",
    validate: (value) => {
      const input = value as Partial<Refund>;
      if (typeof input.paymentId !== "string" || typeof input.amount !== "number") {
        return { issues: [{ message: "invalid refund input" }] };
      }
      return { value: { paymentId: input.paymentId, amount: input.amount } };
    },
    types: { input: null as unknown as Refund, output: null as unknown as Refund },
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
