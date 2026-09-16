import { expectTypeOf } from "vitest";
import { capability } from "../src/capability.ts";
import type { ExecutionContext } from "../src/execution-context.ts";
import type { InputParser } from "../src/schema.ts";

type Refund = { paymentId: string; amount: number };

const refundParser: InputParser<Refund> = {
  parse: (value) => value as Refund,
};

// Parser output, authorize/approval/execute input, and execute return all
// infer without explicit generics.
const refund = capability({
  name: "payments.refund",
  input: refundParser,
  authorize: ({ principalId, input }) => {
    expectTypeOf(principalId).toEqualTypeOf<string>();
    expectTypeOf(input).toEqualTypeOf<Refund>();
    return true;
  },
  approval: ({ principalId, input }) => {
    expectTypeOf(principalId).toEqualTypeOf<string>();
    expectTypeOf(input).toEqualTypeOf<Refund>();
    return input.amount >= 500;
  },
  execute: (input, context) => {
    expectTypeOf(input).toEqualTypeOf<Refund>();
    expectTypeOf(context).toEqualTypeOf<ExecutionContext>();
    expectTypeOf(context.principalId).toEqualTypeOf<string>();
    expectTypeOf(context.idempotencyKey).toEqualTypeOf<string>();
    expectTypeOf(context.signal).toEqualTypeOf<AbortSignal>();
    return { refunded: input.amount };
  },
});

expectTypeOf(refund.name).toEqualTypeOf<string>();
expectTypeOf(refund).not.toHaveProperty("execute");

capability({
  name: "payments.refund",
  // @ts-expect-error execute must receive the parser's validated shape, not
  // a mismatched input type.
  input: refundParser,
  authorize: () => true,
  execute: (input: { wrong: true }) => input,
});
