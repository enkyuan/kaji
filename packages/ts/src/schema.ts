/**
 * Kaji stays validator-neutral. `input` needs only a `parse` method that
 * returns validated input or throws, per docs/api.md: "input needs only a
 * parser that either returns validated input or throws." Zod, Valibot (via
 * `.parse`), and other libraries satisfy this shape without an adapter.
 */
export type InputParser<Output> = {
  parse(input: unknown): Output;
};

/**
 * Validates unknown input against a capability's parser.
 *
 * This is the one canonical validation primitive in Kaji. The future
 * executor calls this exact function so there is never a second path that
 * could let invalid input reach application code.
 */
export function validateInput<Output>(parser: InputParser<Output>, input: unknown): Output {
  return parser.parse(input);
}
