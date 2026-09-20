# Kaji

Kaji is an embedded execution layer for safely turning agent-requested
application actions into real state changes.

```text
agent / framework / direct caller
            ↓
           Kaji
            ↓
   application capability
            ↓
 application / external system
```

Your application already has functions like `refundPayment()` or
`cancelBooking()`. When something outside your direct control — an
agent, an automation, an MCP tool call — can trigger one of those
functions, it needs caller identity, input validation, authorization,
approval, and protection against duplicate or ambiguous side effects.
Kaji standardizes that boundary once, inside your application, instead
of once per caller.

Kaji is a TypeScript library published as `@irogane/kaji` with zero
runtime dependencies. It runs in your process — no server, database,
or control plane.

## Install

```bash
npm install @irogane/kaji
```

## Minimal example

```ts
import { capability, createKaji, knownFailure, memoryStore } from "@irogane/kaji";
import { z } from "zod";

const RefundInput = z.object({
  paymentId: z.string().min(1),
  amount: z.number().positive(),
});

const refund = capability({
  name: "payments.refund",
  input: RefundInput,

  authorize: async ({ principalId, input }) => {
    return canRefund(principalId, input.paymentId);
  },

  approval: ({ input }) => input.amount >= 500,

  execute: async (input, context) => {
    try {
      return await payments.refund({
        ...input,
        idempotencyKey: context.idempotencyKey,
        signal: context.signal,
      });
    } catch (cause) {
      if (isDefinitiveProviderRejection(cause)) throw knownFailure(cause);
      throw cause; // anything else stays unknown: the side effect may have committed
    }
  },
});

const kaji = createKaji({
  store: memoryStore(),
  approve: async () => ({ approved: true }),
});

const result = await kaji.execute(refund, {
  input: { paymentId: "pay_123", amount: 750 },
  principalId: "user_123",
  idempotencyKey: "refund_req_123",
});
```

`canRefund()` and `payments.refund()` are your own application code.
Kaji never sees your domain logic — it only governs when `execute` runs.

## Execution outcomes

`kaji.execute()` resolves with an explicit `status` for every governed
execution; it does not throw for expected outcomes.

```text
execute() resolves
  → succeeded

execute() throws knownFailure(cause)
  → failed

execute() throws or rejects with anything else
  → unknown
```

`unknown` means the side effect may have committed, but Kaji cannot
prove the final result — a thrown error, a timeout, or a cancellation
after `execute()` has started all settle `unknown`, never `failed`.
Kaji never infers a known failure from an error's class, message, or
status code; only application code that can prove no side effect
committed may throw `knownFailure()`. See the
[execution outcomes guide](https://kaji.build/docs/concepts/executor)
for the full model.

## Repository

| Path             | Contents                                          |
| ---------------- | ------------------------------------------------- |
| `packages/ts`    | The library, published as `@irogane/kaji` on npm  |
| `examples/refund` | Complete runnable proof example                  |
| `apps/docs`      | The documentation site, served at kaji.build      |
| `docs/`          | Product, architecture, invariants, API contract, ADRs, playbooks |
| `AGENTS.md`      | Engineering standard and contribution workflow    |

## Documentation

Full documentation, guides, and the API reference are at
[kaji.build](https://kaji.build). Start with
[Getting started](https://kaji.build/docs/getting-started) or read
[what Kaji is and is not](https://kaji.build/docs/architecture).

## License

FSL-1.1-ALv2. See [LICENSE](./LICENSE).
