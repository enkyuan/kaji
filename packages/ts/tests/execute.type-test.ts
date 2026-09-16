import { expectTypeOf } from "vitest";
import { capability } from "../src/capability.ts";
import { createKaji } from "../src/kaji.ts";
import { memoryStore } from "../src/memory-store.ts";
import type { ExecutionResult } from "../src/execution-result.ts";
import type { InputParser } from "../src/schema.ts";

type Refund = { paymentId: string; amount: number };

const refundParser: InputParser<Refund> = {
  parse: (value) => value as Refund,
};

const refund = capability({
  name: "payments.refund",
  input: refundParser,
  authorize: ({ input }) => {
    expectTypeOf(input).toEqualTypeOf<Refund>();
    return true;
  },
  execute: (input) => {
    expectTypeOf(input).toEqualTypeOf<Refund>();
    return { refunded: input.amount };
  },
});

const kaji = createKaji({ store: memoryStore() });

async function typeChecks() {
  const result = await kaji.execute(refund, {
    // `ExecutionRequest.input` is `unknown` per docs/api.md: static input
    // shape is not checked here, only at runtime by the capability's
    // parser. `execute()`'s RESULT type is what stays precise.
    input: { paymentId: "pay_1", amount: 10 },
    principalId: "user_1",
    idempotencyKey: "key_1",
  });

  expectTypeOf(result).toEqualTypeOf<ExecutionResult<{ refunded: number }>>();
  if (result.status === "succeeded") {
    expectTypeOf(result.result).toEqualTypeOf<{ refunded: number }>();
  }
  if (result.status === "denied" || result.status === "rejected" || result.status === "failed") {
    expectTypeOf(result.error).toEqualTypeOf<unknown>();
  }

  // @ts-expect-error principalId is required on ExecutionRequest.
  await kaji.execute(refund, { input: {}, idempotencyKey: "key_1" });
}

void typeChecks;
