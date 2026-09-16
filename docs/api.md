# Public API

Kaji v0 has two primary concepts: a **capability**, which defines one application action, and a **Kaji executor**, which governs each request to run that action.

## Usage

```ts
const refund = capability({
  name: "payments.refund",
  input: schema,

  authorize: async ({ principalId, input }) => {
    return canRefund(principalId, input);
  },

  approval: ({ input }) => input.amount >= 500,

  execute: async (input, context) => {
    return refundPayment({
      ...input,
      idempotencyKey: context.idempotencyKey,
      signal: context.signal,
    });
  },
});

const kaji = createKaji({
  store: memoryStore(),
  approve: async (request) => requestHumanApproval(request),
});

const result = await kaji.execute(refund, {
  input: {
    paymentId: "pay_123",
    amount: 750,
  },
  principalId: user.id,
  idempotencyKey: request.id,
  signal: request.signal,
});
```

## Capability

`capability()` defines one named application action. It validates input, delegates authorization and optional approval policy, and calls ordinary application code only through Kaji's executor.

```ts
export type Capability<Input, Result> = {
  readonly name: string;
};

export function capability<Input, Result>(definition: {
  name: string;
  input: { parse(input: unknown): Input };
  authorize: (request: { principalId: string; input: Input }) => boolean | Promise<boolean>;
  approval?: (request: { principalId: string; input: Input }) => boolean;
  execute: (input: Input, context: ExecutionContext) => Result | Promise<Result>;
}): Capability<Input, Result>;
```

`name` is a stable, non-empty application-defined identifier. `input` needs only a parser that either returns validated input or throws. Schema libraries may adapt to that structural shape; Kaji does not select or export a schema library.

`authorize` receives validated input and returns whether the principal may execute the capability. Returning `false` denies execution. Throwing fails the execution before a side effect.

`approval` is optional. Returning `true` requires approval for that request. Returning `false` does not. Approval policy is capability-specific, while the executor obtains the approval decision.

`execute` is ordinary application code. It receives validated input and the per-execution context. It must use the supplied `AbortSignal` cooperatively when the underlying operation supports it.

## Kaji executor

`createKaji()` creates the executor. The executor owns the canonical execution path: validate, claim idempotency, authorize, obtain approval when needed, execute, and record the explicit outcome.

```ts
export type Kaji = {
  execute<Input, Result>(
    capability: Capability<Input, Result>,
    request: ExecutionRequest,
  ): Promise<ExecutionResult<Result>>;
};

export function createKaji(options: {
  store: ExecutionStore;
  approve?: (request: {
    capability: string;
    principalId: string;
    input: unknown;
    idempotencyKey: string;
  }) =>
    { approved: boolean; evidence?: unknown } | Promise<{ approved: boolean; evidence?: unknown }>;
  timeoutMs?: number;
}): Kaji;
```

`timeoutMs` sets the maximum time Kaji waits for an execution. It does not roll back an effect or prove that a remote operation did not occur. Kaji aborts its execution signal when the timeout elapses.

## Execution request and context

```ts
export type ExecutionRequest = {
  input: unknown;
  principalId: string;
  idempotencyKey: string;
  signal?: AbortSignal;
};

export type ExecutionContext = {
  principalId: string;
  idempotencyKey: string;
  signal: AbortSignal;
};
```

`principalId` and `idempotencyKey` must be non-empty strings. The caller supplies both. Kaji never infers either value from process state.

The context signal combines the caller signal and Kaji's optional timeout. It follows native `AbortSignal` semantics.

## Approval

The application supplies `approve` when any capability can require approval. Kaji passes the capability name, principal ID, validated input, and idempotency key. An absent approver, an invalid decision, a rejected decision, or an approver error prevents execution. The optional approval evidence may be retained in the execution record.

## Results and outcomes

`execute()` resolves with an explicit result for every governed execution. It does not throw for expected execution outcomes. It may reject only when Kaji cannot establish the execution boundary, such as an invalid executor configuration or an unrecoverable store error before an execution record exists.

```ts
export type ExecutionResult<Result> =
  | {
      status: "succeeded";
      result: Result;
      evidence: ExecutionEvidence;
    }
  | {
      status: "denied" | "rejected" | "failed" | "cancelled";
      error: unknown;
      evidence: ExecutionEvidence;
    }
  | {
      status: "unknown";
      error: unknown;
      evidence: ExecutionEvidence;
    };

export type ExecutionEvidence = {
  executionId: string;
  capability: string;
  principalId: string;
  idempotencyKey: string;
  inputFingerprint: string;
};
```

- `succeeded` means `execute` returned successfully.
- `denied` means authorization did not allow the action.
- `rejected` means required approval was unavailable or not granted.
- `failed` means Kaji knows the action did not start or did not succeed.
- `cancelled` means cancellation prevented side-effect execution.
- `unknown` means a side effect may have happened but Kaji cannot prove completion. A timeout or cancellation after `execute` begins produces `unknown`. Callers must not blindly retry `unknown`.

Kaji treats a thrown or rejected `execute` call as `unknown` by default. Only application code knows whether its own side effect may have committed, so this safe default prevents Kaji from misclassifying an ambiguous failure as an ordinary retryable failure.

## Known failure

`knownFailure(cause)` is the one explicit exception to that default. A capability's `execute` function throws it to assert that a specific failure is definitively known — no ambiguous side effect remains — so Kaji settles `failed` instead of `unknown`.

```ts
export function knownFailure(cause: unknown): Error;
```

```ts
execute: async (input, context) => {
  try {
    return await provider.charge(input);
  } catch (cause) {
    if (isDefinitelyDeclined(cause)) throw knownFailure(cause);
    throw cause; // stays unknown: the side effect may have committed
  }
},
```

`knownFailure()` only wraps `cause` for Kaji to recognize; it does not change what the underlying error means. Kaji never infers this classification from an error's class, message, or status code — only application code that can actually prove no side effect committed may throw `knownFailure()`. Every other thrown or rejected `execute` call, including an unrecognized error, still settles `unknown`.

A repeated execution with the same idempotency key and input fingerprint returns the recorded result. Reuse of an idempotency key with different input, capability, or principal must return a conflict as a `failed` result. A concurrent duplicate waits for or receives the same recorded outcome; it must not run `execute` again.

## Execution store

The store persists execution identity, idempotency claims, input fingerprints, outcomes, and minimal result or error evidence. Its claim operation must be atomic enough to prevent duplicate execution for the same operation.

```ts
export type ExecutionClaim = {
  capability: string;
  principalId: string;
  idempotencyKey: string;
  inputFingerprint: string;
};

export type StoredExecution = ExecutionResult<unknown>;

export type ClaimResult =
  | { status: "claimed"; executionId: string }
  | { status: "existing"; outcome: Promise<StoredExecution> }
  | { status: "conflict"; executionId: string };

export type ExecutionStore = {
  claim(claim: ExecutionClaim): Promise<ClaimResult>;
  record(execution: StoredExecution): Promise<void>;
};

export function memoryStore(): ExecutionStore;
```

`ExecutionClaim`, `ClaimResult`, and `StoredExecution` are public only because custom stores must implement the contract. `claim()` atomically creates a claim, returns the outcome of an identical completed or active claim, or reports a conflicting key reuse. The in-memory store is process-local and is the only v0 implementation.

Kaji does not provide a database store, distributed lock, event stream, retry system, or recovery worker in v0.

## Export boundary

The intended v0 exports are:

```ts
export { capability, createKaji, knownFailure, memoryStore };

export type {
  Capability,
  ExecutionContext,
  ExecutionEvidence,
  ExecutionRequest,
  ExecutionResult,
  ExecutionStore,
};
```

`ExecutionClaim`, `ClaimResult`, and `StoredExecution` are exported only from the store entry point. No framework adapters, implementation internals, or additional convenience APIs are part of v0.
