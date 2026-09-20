# release-readiness

Branch: chore/release-readiness
Base: ced0b04 (consolidated main after PR #2)
State: DONE (pending merge)

## Goal

Prove that the exact npm artifact for `@irogane/kaji` is correctly named,
scoped, exported, typed, minimal, installable, and consumable outside the
monorepo before any release infrastructure is added. Nothing was published.

## Artifact record

- Package name: @irogane/kaji
- Current version: 0.0.0 (release tasks own version selection)
- publishConfig: registry https://registry.npmjs.org/, access public (added in this task)
- exports: single root entry "." -> types ./dist/index.d.mts, import ./dist/index.mjs
- files whitelist: ["dist"]
- packed contents (5 files): package.json, README.md, LICENSE, dist/index.mjs, dist/index.d.mts
- packed tarball: irogane-kaji-0.0.0.tgz, 10,974 bytes; sha256 60440481e4c120240a51f7433623bc0a47c9714721c2a0986be10f0956ae4e74
- unpacked size: ~34.7 KB
- runtime dependencies: 0; engines intentionally absent (no platform-specific APIs in src)
- README source: packages/ts/README.md (shipped in tarball); LICENSE identical to root
- dist contains tsdown `//#region src/*.ts` bundler comments (module names only; no filesystem paths, no source)

## Verification (all pass)

- bun install --frozen-lockfile; format:check; lint; typecheck; test (88/88); build; package:check; package:smoke
- publint against the packed tarball: clean
- attw --profile esm-only against the packed tarball: clean
- clean consumer in /tmp (npm project, tarball install, public name imports only):
  - JS outcome matrix: fresh -> succeeded; duplicate replay returns recorded outcome with execute called once; knownFailure -> failed with cause; unrecognized throw -> unknown; same key + different input -> conflict as failed; unauthorized -> denied; absent approver -> rejected
  - TypeScript compile under --strict --module nodenext against tarball declarations
  - no workspace paths in installed package
- proof example executed against the packed tarball in /tmp:
  fresh succeeded (1 execution), duplicate replayed without re-execution, ambiguous lost-ack -> unknown and retry returns recorded unknown without re-execution, declined -> failed (known)

## Decisions

- publishConfig added: scoped packages default to restricted access on npm; without access=public publish fails without CLI overrides.
- README install command gated: `@irogane/kaji@0.2.0-beta.11` already exists on npm and is the old, unrelated agent SDK ("Embeddable SDK for building agents"). The README now states v0 is unpublished and omits the command until the release makes it truthful.
- docs/api.md export boundary reconciled to the shipped root-export shape (one entry point; all nine public type names listed). The prior "store entry point" wording described a subpath split that does not exist and was already recorded as a known deviation in docs/work/handoffs/execution-store.md.

## Invariants

- Public semantics unchanged: no src/ change in this task.
- Exported values: capability, createKaji, knownFailure, memoryStore. Exported types: Capability, ClaimResult, ExecutionClaim, ExecutionContext, ExecutionEvidence, ExecutionRequest, ExecutionResult, ExecutionStore, StoredExecution. No undocumented exports; matches docs/api.md.

## Changed

- packages/ts/package.json (publishConfig)
- packages/ts/README.md (install command gated pre-release)
- docs/api.md (export boundary wording matches shipped artifact)

## Remaining release blockers / notes

1. Live site apps/docs index (apps/docs/src/pages/index.astro line 9) still shows `npm install @irogane/kaji`, which resolves to the old agent SDK today. Needs gating or removal until publish, then redeploy.
2. npm already hosts @irogane/kaji 0.2.0-beta.11 — the previous product under the same name. Scope ownership verified: sole maintainer is `enkyuan <yuan_enkang@outlook.com>` (2026-08-28), so publishing the new artifact under @irogane/kaji is viable. Recommend `npm deprecate @irogane/kaji@0.2.0-beta.11` during the release task so the window with a wrong-package install shrinks. Version selection and dist-tags belong to release tasks.
3. CI docs workflow (branch ci/docs-deploy, commits 45401dd + 47a2026) is complete locally but cannot be pushed by the agent (workflow-content pushes are blocked by the local git guard). The deploy step is gated on the CLOUDFLARE_API_TOKEN secret and stays skipped until it exists.
4. GitButler workspace in the primary checkout still has 7 applied virtual branches whose remote counterparts were deleted after consolidation; unapply them locally to avoid stale refs. Uncommitted workspace WIP (logo.svg, active.md) is untouched.

## Next

chore/npm-release-infra: re-enable the install commands (README + site) as part of the publish sequence, add trusted publishing/OIDC per its own scope, select version, publish, verify.
