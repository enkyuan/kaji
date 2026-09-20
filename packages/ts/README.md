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

Kaji is a TypeScript library with zero runtime dependencies. It runs in
your process — no server, database, or control plane.

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

## Why Kaji

- **Explicit identity.** Every execution requires a caller-supplied
  `principalId`. Kaji never infers one from process state.
- **Validation before anything else.** Invalid input never reaches
  `authorize`, `approval`, or `execute`.
- **Duplicate suppression.** A caller-supplied `idempotencyKey` claims
  one intended operation; a repeated request with the same key replays
  the recorded result instead of running `execute` again.
- **Fail-closed approval.** A capability declares when approval is
  required; the host application supplies how a decision is obtained;
  a missing, rejected, or failed decision prevents execution.
- **Explicit failure semantics.** `succeeded`, `failed`, and `unknown`
  are distinct outcomes — see below.

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
[execution outcomes guide](https://kaji.build/docs/concepts/outcomes)
for the full model.

## memoryStore()

`createKaji()` needs an `ExecutionStore`. `memoryStore()` is the
built-in reference implementation:

```ts
import { memoryStore } from "@irogane/kaji";

const kaji = createKaji({ store: memoryStore() });
```

`memoryStore()` is process-local and in-memory. It is useful for local
development, tests, and examples — it is not durable and does not
coordinate across processes or instances. A production deployment needs
an `ExecutionStore` backed by durable, atomic storage; see
[custom store](https://kaji.build/docs/guides/custom-store).

## What Kaji is not

Kaji does not provide an agent framework, model SDK, workflow engine,
MCP runtime, tool registry, identity provider, queue, scheduler, retry
engine, or event-sourcing system. Your application supplies identity,
authorization policy, and domain logic; Kaji only governs how a request
to run one action is validated, authorized, approved, executed once,
and recorded.

## Documentation

Full documentation, guides, and the API reference are at
[kaji.build](https://kaji.build). A complete runnable proof example
lives in [`examples/refund`](https://github.com/enkyuan/kaji/tree/main/examples/refund)
in the repository.

## License

FSL-1.1-ALv2. See [LICENSE](https://github.com/enkyuan/kaji/blob/main/LICENSE).
