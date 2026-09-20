/**
 * Kaji's capability input contract is Standard Schema V1
 * (https://github.com/standard-schema/standard-schema). The specification
 * permits consumers to define its interface locally instead of adding a
 * dependency, so the structural types below mirror the current V1 spec
 * without making `@standard-schema/spec` a package dependency. Kaji
 * consumes only the validation protocol: it never converts schemas, never
 * calls a validator's own methods, and never depends on a validator.
 *
 * Only the validation protocol is vendored. Standard JSON Schema, metadata
 * extensions, and future versions are out of Kaji's scope.
 */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly "~standard": StandardSchemaProps<Input, Output>;
}

export interface StandardSchemaProps<Input = unknown, Output = Input> {
  readonly version: 1;
  readonly vendor: string;
  readonly validate: (
    value: unknown,
    options?: StandardSchemaOptions | undefined,
  ) => StandardSchemaResult<Output> | Promise<StandardSchemaResult<Output>>;
  readonly types?: StandardSchemaTypes<Input, Output> | undefined;
}

export type StandardSchemaResult<Output> = StandardSchemaSuccess<Output> | StandardSchemaFailure;

export interface StandardSchemaSuccess<Output> {
  readonly value: Output;
  readonly issues?: undefined;
}

export interface StandardSchemaFailure {
  readonly issues: ReadonlyArray<StandardSchemaIssue>;
}

export interface StandardSchemaOptions {
  readonly libraryOptions?: Record<string, unknown> | undefined;
}

export interface StandardSchemaIssue {
  readonly message: string;
  readonly path?: ReadonlyArray<PropertyKey | StandardSchemaPathSegment> | undefined;
}

export interface StandardSchemaPathSegment {
  readonly key: PropertyKey;
}

export interface StandardSchemaTypes<Input = unknown, Output = Input> {
  readonly input: Input;
  readonly output: Output;
}

/**
 * The schema OUTPUT type Kaji's callbacks receive. Standard Schema
 * distinguishes a schema's input type from its validated output type;
 * Kaji receives `ExecutionRequest.input` as `unknown` and passes the
 * validated output to authorize, approval, fingerprinting, and execute.
 *
 * Inference rides the spec's optional `types` field, so declare `types`
 * on hand-written schemas (vendor schemas declare it themselves). A
 * schema without `types` still validates correctly at runtime; only
 * compile-time inference degrades.
 */
export type SchemaOutput<Schema extends StandardSchemaV1> = NonNullable<
  Schema["~standard"]["types"]
>["output"];

/**
 * Thrown when `validateInput()` reports Standard Schema issues, before any
 * claim, authorization, approval, or execution. It surfaces to the
 * `kaji.execute()` caller as an ordinary `Error` whose `issues` property
 * carries the structured Standard Schema issues verbatim — never
 * flattened into the message string alone.
 */
export class InvalidInputError extends Error {
  readonly issues: ReadonlyArray<StandardSchemaIssue>;

  constructor(issues: ReadonlyArray<StandardSchemaIssue>) {
    super(formatIssues(issues));
    this.name = "InvalidInputError";
    this.issues = issues;
  }
}

function formatIssues(issues: ReadonlyArray<StandardSchemaIssue>): string {
  const lines = issues.map((issue) => {
    const path = formatPath(issue.path);
    return path === "" ? `- ${issue.message}` : `- ${path}: ${issue.message}`;
  });
  return ["Invalid capability input.", ...lines].join("\n");
}

function formatPath(path: ReadonlyArray<PropertyKey | StandardSchemaPathSegment> | undefined) {
  if (path === undefined || path.length === 0) {
    return "";
  }
  return path
    .map((segment) => String(typeof segment === "object" ? segment.key : segment))
    .join(".");
}

/**
 * Validates unknown input against a capability's Standard Schema.
 *
 * This is the one canonical validation primitive in Kaji. The executor
 * calls this exact function, so there is never a second path that could
 * let invalid input reach application code. It consumes the full Standard
 * Schema V1 result contract: synchronous or asynchronous validation, and
 * failure reported as structured issues rather than a thrown error.
 */
export async function validateInput<Output>(
  schema: StandardSchemaV1<unknown, Output>,
  input: unknown,
): Promise<Output> {
  const result = await schema["~standard"].validate(input);
  // The spec's result contract: a falsy `issues` indicates success, so any
  // issues array — even empty — is a failure. Success carries `value`.
  if (result.issues) {
    throw new InvalidInputError(result.issues);
  }
  return result.value;
}
