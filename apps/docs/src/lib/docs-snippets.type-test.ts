/**
 * Compiles the critical documentation snippets against the real public
 * API of @irogane/kaji. This file is not imported by the site; its only
 * purpose is to fail `astro check` (and therefore CI) if a documented
 * snippet no longer matches the package's actual exports or signatures.
 *
 * Keep each snippet mechanically identical to its documentation page.
 * If a snippet here would need `any` or a type suppression to compile,
 * the documented snippet is wrong — fix the docs, not this file.
 */
import { capability, createKaji, knownFailure, memoryStore } from "@irogane/kaji";
import type { ExecutionStore, ExecutionClaim, ClaimResult, StoredExecution } from "@irogane/kaji";
import { z } from "zod";

// --- install.mdx / getting-started.mdx: input schema ---
const RefundInput = z.object({
  paymentId: z.string().min(1),
  amount: z.number().positive(),
});

type Refund = { refundId: string };
declare function canRefund(principalId: string, paymentId: string): boolean;
declare function isDefinitiveProviderRejection(cause: unknown): boolean;
declare const payments: {
  refund(request: {
    paymentId: string;
    amount: number;
    idempotencyKey: string;
    signal: AbortSignal;
  }): Promise<Refund>;
};

// --- getting-started.mdx / README.md: define the capability ---
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
      throw cause;
    }
  },
});

// --- getting-started.mdx: create the executor ---
const kaji = createKaji({
  store: memoryStore(),
  approve: async () => ({ approved: true }),
});

// --- getting-started.mdx / README.md: execute ---
async function runQuickstart() {
  const result = await kaji.execute(refund, {
    input: { paymentId: "pay_123", amount: 750 },
    principalId: "user_123",
    idempotencyKey: "refund_req_123",
  });

  if (result.status === "succeeded") {
    console.log(result.result);
  }
}
void runQuickstart;

// --- concepts/outcomes.mdx: knownFailure() usage shape ---
declare class PaymentDeclinedError extends Error {}
declare const paymentsWithTypedError: {
  refund(request: {
    paymentId: string;
    amount: number;
    idempotencyKey: string;
    signal: AbortSignal;
  }): Promise<Refund>;
};
const refundWithTypedKnownFailure = capability({
  name: "payments.refund.typed",
  input: RefundInput,
  authorize: async ({ principalId, input }) => canRefund(principalId, input.paymentId),
  execute: async (input, context) => {
    try {
      return await paymentsWithTypedError.refund({
        ...input,
        idempotencyKey: context.idempotencyKey,
        signal: context.signal,
      });
    } catch (cause) {
      if (cause instanceof PaymentDeclinedError) {
        throw knownFailure(cause);
      }
      throw cause;
    }
  },
});
void refundWithTypedKnownFailure;

// --- guides/custom-store.mdx: ExecutionStore contract compiles as documented ---
declare function isMatchingClaim(claim: ExecutionClaim): boolean;
declare function readStoredClaim(claim: ExecutionClaim): StoredExecution | undefined;
declare function createExecutionId(): string;

class DocsExampleStore implements ExecutionStore {
  async claim(claim: ExecutionClaim): Promise<ClaimResult> {
    const existing = readStoredClaim(claim);
    if (existing !== undefined) {
      return { status: "existing", outcome: Promise.resolve(existing) };
    }
    if (isMatchingClaim(claim)) {
      return { status: "conflict", executionId: createExecutionId() };
    }
    return { status: "claimed", executionId: createExecutionId() };
  }

  async record(_execution: StoredExecution): Promise<void> {}
}
void DocsExampleStore;

// --- guides/authorization-and-approval.mdx: approve handler shape ---
declare function requestHumanApproval(request: {
  capability: string;
  principalId: string;
  input: unknown;
  idempotencyKey: string;
}): Promise<{ approved: boolean }>;

const kajiWithApproval = createKaji({
  store: memoryStore(),
  approve: async (request) => {
    return await requestHumanApproval(request);
  },
});
void kajiWithApproval;
