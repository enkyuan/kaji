import { describe, expect, it } from "vitest";
import { fingerprintInput, UnfingerprintableValueError } from "../src/fingerprint.ts";

describe("fingerprintInput", () => {
  it("produces identical fingerprints for identical validated values", () => {
    const a = fingerprintInput("payments.refund", { paymentId: "pay_1", amount: 10 });
    const b = fingerprintInput("payments.refund", { paymentId: "pay_1", amount: 10 });

    expect(a).toBe(b);
  });

  it("is not affected by object key insertion order", () => {
    const a = fingerprintInput("payments.refund", { amount: 10, paymentId: "pay_1" });
    const b = fingerprintInput("payments.refund", { paymentId: "pay_1", amount: 10 });

    expect(a).toBe(b);
  });

  it("changes when the input is materially different", () => {
    const a = fingerprintInput("payments.refund", { paymentId: "pay_1", amount: 10 });
    const b = fingerprintInput("payments.refund", { paymentId: "pay_1", amount: 20 });

    expect(a).not.toBe(b);
  });

  it("preserves array order", () => {
    const a = fingerprintInput("batch.process", { ids: ["a", "b"] });
    const b = fingerprintInput("batch.process", { ids: ["b", "a"] });

    expect(a).not.toBe(b);
  });

  it("preserves primitive type distinctions", () => {
    const asString = fingerprintInput("payments.refund", { amount: "10" });
    const asNumber = fingerprintInput("payments.refund", { amount: 10 });

    expect(asString).not.toBe(asNumber);
  });

  it("rejects unsupported durable values clearly", () => {
    expect(() => fingerprintInput("payments.refund", { amount: () => 10 })).toThrow(
      UnfingerprintableValueError,
    );
    expect(() => fingerprintInput("payments.refund", { amount: Number.NaN })).toThrow(
      UnfingerprintableValueError,
    );
    expect(() => fingerprintInput("payments.refund", { amount: undefined })).toThrow(
      UnfingerprintableValueError,
    );
  });

  it("does not depend on random or process-specific data", () => {
    const first = fingerprintInput("payments.refund", { paymentId: "pay_1", amount: 10 });
    const second = fingerprintInput("payments.refund", { paymentId: "pay_1", amount: 10 });

    expect(first).toBe(second);
  });
});
