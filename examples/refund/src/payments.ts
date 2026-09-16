/**
 * A tiny fake external payment provider. This is application/external-
 * service simulation, not Kaji's idempotency implementation: it tracks its
 * own committed refunds by idempotency key the way a real provider (e.g.
 * Stripe) would, so this example can prove whether a refund happened once
 * or twice independent of anything Kaji records.
 */

export type RefundRequest = {
  readonly paymentId: string;
  readonly amount: number;
  readonly idempotencyKey: string;
  readonly signal: AbortSignal;
};

export type Refund = {
  readonly refundId: string;
  readonly paymentId: string;
  readonly amount: number;
};

/** Thrown when the provider can prove the refund was never charged. */
export class PaymentDeclinedError extends Error {
  constructor(paymentId: string) {
    super(`Payment "${paymentId}" was declined before any refund was committed.`);
    this.name = "PaymentDeclinedError";
  }
}

/**
 * Thrown when the provider committed the refund but the acknowledgement
 * that would confirm it was lost (e.g. the connection dropped after the
 * provider accepted the request). The refund may have happened; this
 * function cannot say either way.
 */
export class AcknowledgementLostError extends Error {
  constructor(paymentId: string) {
    super(`Acknowledgement for payment "${paymentId}" was lost after the request was sent.`);
    this.name = "AcknowledgementLostError";
  }
}

export function createPaymentService() {
  const refundablePayments = new Map([["pay_123", { ownerId: "user_123", amount: 1000 }]]);
  const committedRefunds = new Map<string, Refund>();
  let nextRefundId = 1;

  return {
    /** How many refunds this provider has actually committed. Test-only proof hook. */
    committedRefundCount(): number {
      return committedRefunds.size;
    },

    ownerOf(paymentId: string): string | undefined {
      return refundablePayments.get(paymentId)?.ownerId;
    },

    /**
     * Refunds a payment. The provider's own idempotency key reuse returns
     * the same committed refund instead of charging twice — this mirrors
     * real payment providers and is independent of Kaji's idempotency.
     */
    async refund(request: RefundRequest): Promise<Refund> {
      const existing = committedRefunds.get(request.idempotencyKey);
      if (existing !== undefined) return existing;

      request.signal.throwIfAborted();

      const payment = refundablePayments.get(request.paymentId);
      if (payment === undefined || request.amount > payment.amount) {
        throw new PaymentDeclinedError(request.paymentId);
      }

      const refund: Refund = {
        refundId: `ref_${String(nextRefundId++).padStart(3, "0")}`,
        paymentId: request.paymentId,
        amount: request.amount,
      };
      committedRefunds.set(request.idempotencyKey, refund);
      return refund;
    },

    /**
     * Simulates a provider that commits the refund but never returns an
     * acknowledgement — the exact ambiguous case Kaji's `unknown` outcome
     * exists for. The side effect happens; the caller never learns that
     * directly from this call.
     */
    async refundWithLostAcknowledgement(request: RefundRequest): Promise<never> {
      const refund: Refund = {
        refundId: `ref_${String(nextRefundId++).padStart(3, "0")}`,
        paymentId: request.paymentId,
        amount: request.amount,
      };
      committedRefunds.set(request.idempotencyKey, refund);
      throw new AcknowledgementLostError(request.paymentId);
    },
  };
}

export type PaymentService = ReturnType<typeof createPaymentService>;
