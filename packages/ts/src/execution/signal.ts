/**
 * Combines the caller's signal (if any) with Kaji's optional `timeoutMs`
 * into one effective `AbortSignal`, using only native `AbortSignal`/
 * `AbortController` primitives (docs/invariants.md "Native primitives
 * first"). `cleanup()` must be called once execution finishes so the
 * timeout timer does not keep the process alive.
 */
export function effectiveSignal(
  callerSignal: AbortSignal | undefined,
  timeoutMs: number | undefined,
): { signal: AbortSignal; cleanup: () => void } {
  if (timeoutMs === undefined) {
    return { signal: callerSignal ?? new AbortController().signal, cleanup: () => {} };
  }

  const timeoutController = new AbortController();
  const timer = setTimeout(() => timeoutController.abort(), timeoutMs);
  const signal =
    callerSignal === undefined
      ? timeoutController.signal
      : AbortSignal.any([callerSignal, timeoutController.signal]);

  return { signal, cleanup: () => clearTimeout(timer) };
}
