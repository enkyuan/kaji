import { expectTypeOf } from "vitest";
import { capability } from "../src/capability.ts";
import { createKaji } from "../src/kaji.ts";
import { memoryStore } from "../src/store/memory.ts";
import type { ExecutionResult } from "../src/execution/result.ts";
import type { StandardSchemaV1 } from "../src/schema.ts";

/**
 * Transformed schema (string -> number): the request input stays `unknown`,
 * the execution RESULT type stays precise, and callbacks see the output.
 */
const amountSchema: StandardSchemaV1<string, number> = {
  "~standard": {
    version: 1,
    vendor: "test",
    validate: (value) => ({ value: Number(value) }),
    types: { input: null as unknown as string, output: null as unknown as number },
  },
};

const charge = capability({
  name: "payments.charge",
  input: amountSchema,
  authorize: ({ input }) => {
    expectTypeOf(input).toEqualTypeOf<number>();
    return true;
  },
  execute: (input) => {
    expectTypeOf(input).toEqualTypeOf<number>();
    return { charged: input };
  },
});

const kaji = createKaji({ store: memoryStore() });

async function typeChecks() {
  const result = await kaji.execute(charge, {
    // `ExecutionRequest.input` is `unknown` per docs/api.md: static input
    // shape is not checked here, only at runtime by the schema's validate.
    // `execute()`'s RESULT type is what stays precise.
    input: "750",
    principalId: "user_1",
    idempotencyKey: "key_1",
  });

  expectTypeOf(result).toEqualTypeOf<ExecutionResult<{ charged: number }>>();
  if (result.status === "succeeded") {
    expectTypeOf(result.result).toEqualTypeOf<{ charged: number }>();
  }
  if (result.status === "denied" || result.status === "rejected" || result.status === "failed") {
    expectTypeOf(result.error).toEqualTypeOf<unknown>();
  }

  // @ts-expect-error principalId is required on ExecutionRequest.
  await kaji.execute(charge, { input: "750", idempotencyKey: "key_1" });
}

void typeChecks;
