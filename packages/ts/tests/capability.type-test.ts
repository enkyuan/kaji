import { expectTypeOf } from "vitest";
import { capability } from "../src/capability.ts";
import type { ExecutionContext } from "../src/execution/context.ts";
import type { StandardSchemaV1 } from "../src/schema.ts";

/**
 * A transformed schema: Kaji receives `unknown` and validates to `number`,
 * so every callback must see the OUTPUT type (number), never the schema's
 * INPUT type (string) — inferred without explicit generics.
 */
const amountSchema: StandardSchemaV1<string, number> = {
  "~standard": {
    version: 1,
    vendor: "test",
    validate: (value) => ({ value: Number(value) }),
    types: { input: null as unknown as string, output: null as unknown as number },
  },
};

const capped = capability({
  name: "payments.capped",
  input: amountSchema,
  authorize: ({ principalId, input }) => {
    expectTypeOf(principalId).toEqualTypeOf<string>();
    expectTypeOf(input).toEqualTypeOf<number>();
    return true;
  },
  approval: ({ principalId, input }) => {
    expectTypeOf(principalId).toEqualTypeOf<string>();
    expectTypeOf(input).toEqualTypeOf<number>();
    return input >= 500;
  },
  execute: (input, context) => {
    expectTypeOf(input).toEqualTypeOf<number>();
    expectTypeOf(context).toEqualTypeOf<ExecutionContext>();
    expectTypeOf(context.principalId).toEqualTypeOf<string>();
    expectTypeOf(context.idempotencyKey).toEqualTypeOf<string>();
    expectTypeOf(context.signal).toEqualTypeOf<AbortSignal>();
    return { charged: input };
  },
});

expectTypeOf(capped.name).toEqualTypeOf<string>();
expectTypeOf(capped).not.toHaveProperty("execute");

capability({
  name: "payments.capped",
  input: amountSchema,
  authorize: () => true,
  // @ts-expect-error execute must receive the schema's validated OUTPUT
  // (number), not the schema's INPUT (string).
  execute: (input: string) => input,
});

capability({
  name: "payments.capped",
  // @ts-expect-error only Standard Schema objects satisfy the input contract.
  input: { parse: (value: unknown) => Number(value) },
  authorize: () => true,
  execute: (input) => input,
});
