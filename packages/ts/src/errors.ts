/**
 * Thrown only when Kaji cannot establish the execution boundary at all —
 * an invalid executor configuration, or a store failure before any
 * execution record exists. Every other outcome (denied, rejected, failed,
 * cancelled, unknown) is an ordinary `ExecutionResult`, not a thrown error;
 * see docs/api.md "Results and outcomes".
 */
export class KajiConfigurationError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "KajiConfigurationError";
  }
}
