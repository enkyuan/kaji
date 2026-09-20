import type { ExecutionContext } from "./execution/context.ts";
import type { InputParser } from "./schema.ts";

/**
 * A request to authorize or require approval for one capability execution.
 * Kept inline rather than named because it is not part of the store contract
 * and does not need to be constructed by callers.
 */
type PrincipalRequest<Input> = {
  readonly principalId: string;
  readonly input: Input;
};

/**
 * Declares one application action: its validated input contract,
 * authorization/approval rules, and the function Kaji will eventually
 * execute. A capability does not execute itself; `feat/execute` owns that.
 *
 * `Input` is the parser's returned/validated type, matching what
 * `authorize`, `approval`, and `execute` receive.
 */
export type CapabilityDefinition<Input, Result> = {
  readonly name: string;
  readonly input: InputParser<Input>;
  readonly authorize: (request: PrincipalRequest<Input>) => boolean | Promise<boolean>;
  readonly approval?: (request: PrincipalRequest<Input>) => boolean;
  readonly execute: (input: Input, context: ExecutionContext) => Result | Promise<Result>;
};

/**
 * The declared capability, as frozen by docs/api.md.
 *
 * Only `name` is public today. `Input` and `Result` are retained as type
 * parameters (unused at this field) because a future `Kaji.execute()` needs
 * `Capability<Input, Result>` to recover both types; removing them now would
 * force `feat/execute` to redesign this type. The unused-type-parameter
 * warning this produces is suppressed in .oxlintrc.json for this file.
 */
export type Capability<Input, Result> = {
  readonly name: string;
};

/**
 * Defines one application action that Kaji can later execute safely.
 *
 * `capability()` is the single canonical constructor. It validates its own
 * declaration (name, hooks) at construction time; it never invokes
 * `authorize`, `approval`, or `execute` itself.
 */
export function capability<Input, Result>(
  definition: CapabilityDefinition<Input, Result>,
): Capability<Input, Result> {
  const name = definition.name;
  if (typeof name !== "string" || name.trim().length === 0) {
    throw new Error("capability() requires a non-empty name.");
  }
  if (typeof definition.authorize !== "function") {
    throw new Error("capability() requires an authorize function.");
  }

  return Object.freeze({
    name,
    input: definition.input,
    authorize: definition.authorize,
    approval: definition.approval,
    execute: definition.execute,
  });
}

/**
 * Recovers the full declaration from a `Capability`. The public
 * `Capability<Input, Result>` type only advertises `name`, but the object
 * `capability()` returns always carries `input`/`authorize`/`approval`/
 * `execute` — the executor is their one legitimate reader.
 */
export function capabilityDefinition<Input, Result>(
  capability: Capability<Input, Result>,
): CapabilityDefinition<Input, Result> {
  return capability as unknown as CapabilityDefinition<Input, Result>;
}
