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

/**
 * Marks a capability's `execute` failure as definitively known rather than
 * ambiguous: application code is asserting that no side effect committed,
 * so Kaji may settle `failed` instead of its safe `unknown` default. See
 * docs/invariants.md "Ambiguous outcomes are preserved" and "Known failure
 * is explicit".
 *
 * `knownFailure()` is the only way to opt out of `unknown`. Kaji never
 * infers this from an error's class, message, or status code — only
 * application code that actually knows the remote side effect did not
 * commit may make this claim.
 */
export class KnownFailure extends Error {
  constructor(cause: unknown) {
    super("Capability execution failed with a definitively known outcome.", { cause });
    this.name = "KnownFailure";
  }
}

/**
 * Wraps `cause` so a capability's `execute` function can throw it to
 * report an ordinary, provably non-ambiguous failure (docs/api.md).
 *
 * Usage:
 * ```ts
 * execute: async (input, context) => {
 *   try {
 *     return await provider.charge(input);
 *   } catch (cause) {
 *     if (isDefinitelyDeclined(cause)) throw knownFailure(cause);
 *     throw cause; // stays unknown: the side effect may have committed
 *   }
 * },
 * ```
 */
export function knownFailure(cause: unknown): KnownFailure {
  return new KnownFailure(cause);
}
