/**
 * Thrown when a value falls outside the durable value domain — plain
 * JSON-shaped data — and cannot be fingerprinted deterministically.
 * Capability input is schema-validated application data, so this is the
 * natural boundary: it excludes functions, symbols, and other values a
 * schema parser would not normally produce.
 */
export class UnfingerprintableValueError extends Error {
  constructor(reason: string) {
    super(`Cannot fingerprint input: ${reason}`);
    this.name = "UnfingerprintableValueError";
  }
}

/**
 * Produces a deterministic string for one capability's validated input.
 *
 * Object key order must not affect the result — two semantically identical
 * inputs must fingerprint identically regardless of how their keys were
 * constructed — so this canonicalizes objects by sorting keys before
 * serializing, rather than relying on `JSON.stringify`'s insertion order.
 */
export function fingerprintInput(capability: string, input: unknown): string {
  return `${capability}:${canonicalize(input)}`;
}

function canonicalize(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new UnfingerprintableValueError(`non-finite number ${value}`);
    }
    return JSON.stringify(value);
  }
  if (typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }
  if (typeof value === "object") {
    const keys = Object.keys(value).sort();
    const entries = keys.map(
      (key) => `${JSON.stringify(key)}:${canonicalize((value as Record<string, unknown>)[key])}`,
    );
    return `{${entries.join(",")}}`;
  }
  throw new UnfingerprintableValueError(`unsupported value of type ${typeof value}`);
}
