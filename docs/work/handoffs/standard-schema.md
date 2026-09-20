# refactor/standard-schema

Branch: refactor/standard-schema
Base SHA: 21b40c3fd51d4ddb7ebc97e00ae26691f19b96d5 (origin/main at task start)
Head SHA: see git log — recorded after final review pass
State: IMPLEMENTING — code complete and verified; docs reconciliation pending

## Goal

Replace Kaji's custom `{ parse(input): Output }` capability input contract
with Standard Schema V1. Replacement, not additive compatibility.

## Coordination state (O1-2 / O2-2)

`docs/editorial-review` owned the shared docs surfaces while this branch was
implemented, so README.md, packages/ts/README.md, docs/api.md,
docs/invariants.md, and apps/docs content pages are intentionally NOT edited
here yet. Remaining work after editorial-review merges: rebase, replace every
remaining `.parse()`/InputParser contract claim in those files, preserve the
README byte-identity invariant (`readme:check`), rerun the full docs +
package suite, and merge only after explicit approval of the complete
code + docs diff.

## Decisions

- Standard Schema V1 is the sole capability validation contract; a
  `.parse()`-only object now fails `capability()` construction
- the official V1 validation-protocol interfaces are vendored into
  `schema.ts` as internal structural types (the spec explicitly permits
  local copies); `@standard-schema/spec` was NOT added as a dependency
- validation consumes the full V1 result contract: sync or async
  `validate`, failure as structured issues (a falsy `issues` means
  success; any issues array — even empty — is failure)
- validated OUTPUT drives authorize, approval, fingerprinting, and
  execute; inference flows from the schema's `types.output` without
  explicit generics (`SchemaOutput<Schema>`)
- `validateInput()` became asynchronous; the executor awaits it and
  re-checks the abort signal after it settles (new cancellation boundary
  before fingerprint/claim — a pending validator cannot be cancelled, but
  Kaji guarantees no claim/execution can follow)
- one internal error type, `InvalidInputError`, thrown pre-claim; its
  `issues` property preserves structured Standard Schema issues verbatim
- capability construction checks: object with `~standard`, version === 1,
  `validate` is a function; validate is never invoked at construction;
  extra vendor fields are accepted
- no adapters, no registry, no JSON Schema, no root export growth
  (export line in dist/index.d.mts is byte-identical to baseline)
- valibot ^1 added as the only new devDependency of packages/ts
  (interoperability proof); runtime dependencies remain 0
- ArkType intentionally not added
- no version bump, no release

## TDD order deviation (documented)

The task's sequence placed tests before implementation. In practice
`schema.ts` and `capability.ts` landed before the test rewrites. Mitigations:
the official spec was fetched and read before any code; the protocol tests
assert spec-literal rules (issues-wins-over-value, falsy-issues success,
path preservation, raw-input passthrough) taken from the spec text rather
than observed behavior; and the independent adversarial review inspects the
combined diff against the task checklist.

## Compatibility impact (for the release-versioning decision)

- Hand-written `.parse()`-only input schemas STOP working: `capability()`
  now rejects them at construction (`missing "~standard"`). Affected
  consumers must wrap or replace them with a Standard Schema V1
  implementation. There is no fallback, by design.
- The invalid-input rejection VALUE changes. Previously `kaji.execute()`
  threw the validator's own error (for Zod, a `ZodError` — a vendor type,
  never a Kaji contract). It now throws an internal `InvalidInputError`
  (`name === "InvalidInputError"`) whose `issues` property carries the
  structured Standard Schema issues (message + path). Consumers catching
  `ZodError` by `instanceof` must switch to duck-typing `error.name` /
  `error.issues`. No class export is offered by default.
- The published 0.3.x input contract is therefore broken for non-Standard
  Schema producers; semver classification (minor vs major vs pre-1.0
  refinement) is explicitly left to a separately authorized versioning task.
- Related, already tracked: the editorial handoff records the approval-
  predicate stranded-claim defect as release-blocking before the next
  package release. This task does not touch approval semantics.

## Changed

- packages/ts/src/schema.ts — vendored V1 types, SchemaOutput,
  InvalidInputError, async validateInput
- packages/ts/src/capability.ts — Schema-generic definition, construction
  checks, capabilityDefinition widened to StandardSchemaV1<unknown, Output>
- packages/ts/src/execution/execute.ts — await validation + post-validation
  abort re-check
- packages/ts/scripts/smoke-package.ts — hand-written ~standard consumer
- packages/ts/tests/ — schema.test.ts (protocol + construction + valibot),
  capability.type-test.ts and execution.type-test.ts (transform inference),
  execution-failures.test.ts (async ordering), execution-cancellation.test.ts
  (cancel during pending validation), execution-replay.test.ts (fingerprint
  of transformed output), execution-fixtures.ts (Standard Schema fixture)
- packages/ts/package.json + bun.lock — devDependency valibot ^1

## Verification

- bun install --frozen-lockfile OK; format:check, lint PASS
- vitest 107/107 (was 88; +19 Standard Schema protocol/inference/interop)
- typecheck, build, package:check (publint + attw esm-only) PASS
- package:smoke PASS (hand-written ~standard consumer, strict tsc)
- example:refund PASS (Zod passed directly, no adapter)
- export surface: dist/index.d.mts export line identical to baseline;
  declarations readable (vendored interfaces inlined as internal blocks)
- npm pack: exactly LICENSE, README.md, package.json, dist/index.mjs,
  dist/index.d.mts; `dependencies` field absent (0 runtime deps)
- clean-consumer battery (packed tarball, npm install, Node 24):
  Zod 4.6.5 — transform "750"→750, strict tsc, issue preservation, replay;
  Valibot — same battery, PASS

## Adversarial review

fusion_investigate verdict: APPROVE-WITH-NITS (all 15 checklist items pass
with file:line evidence; run investigate-e687f0033dda3e6fe46f6e22257d838c).
Findings resolved on this branch:

- callable conforming schemas were falsely rejected by the object-only
  construction gate (ArkType's callable Type would have thrown the
  misleading missing-~standard error) — gate now accepts object or
  function holders carrying `~standard`, with a callable-schema test
- docs/playbooks/release.md registry smoke still used the parse contract
  and would throw at capability() — rewritten to a Standard Schema fixture
  (release.md is this branch's file; docs/api.md remains deferred to the
  editorial reconciliation)
- SchemaOutput doc note added: inference rides the optional `types` field;
  schemas without it validate fine at runtime but lose compile-time
  inference

Accepted observations (no action): never-settling validators leave
execute() pending until timeoutMs decides the post-settle outcome; a
non-object validate result surfaces as a raw TypeError (same throw path as
vendor errors); validateInput does not forward `options` (optional param).

## Remaining

- docs reconciliation after docs/editorial-review merges (see above)
- release/versioning decision (explicitly out of scope here)
- adversarial review verdict recorded below when complete

## Next

Collect adversarial review; resolve findings; simplification pass; commit,
push, open PR; leave UNMERGED pending editorial merge + full docs
reconciliation + explicit approval.
