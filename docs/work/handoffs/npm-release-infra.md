# npm-release-infra

Branch: chore/npm-release-infra
Base: main b58d926 (finalized chore/release-readiness via PR #3)
State: REVIEW (PR open; no merge, no publication)

## Goal

Add a tokenless, manually triggered npm staging workflow that verifies the
repository, builds and validates the exact artifact, stages it privately to
npm, and stops before public approval. Nothing was published.

## Decisions

- Staged publishing verified against npm 11.19.0 CLI (`npm stage --help`,
  `npm help stage`, and CLI source): GA since npm 11.15.0 (2026-05-22),
  requires Node >= 22.14. `npm stage publish <spec>` shares npm publish's
  spec handling (`npa(args[0])` in publish.js) — a tarball path is a valid
  spec, so the gate-validated tarball itself is staged (literal pack-once).
- `npm stage list` may lack authentication inside CI (OIDC covers staging
  only); the workflow's summary step falls back to a local-command hint.
  The authoritative stage list is local: `npm stage list @irogane/kaji`.
- Version stays 0.0.0. The release tasks (release/0.3.0-rc.1) own bumps.

## Record

- Workflow path: .github/workflows/publish.yml
- Trigger: workflow_dispatch, input `channel` in {next, latest} only; no
  push/PR/tag/merge triggers
- Environment name: npm-release (protection rules configured externally)
- Permissions: contents: read, id-token: write; no secrets referenced
- Concurrency: group npm-release, cancel-in-progress false
- Node version: 24 (LTS, >= 22.14 required by npm staged/trusted publishing)
- npm version: pinned 11.19.0 (>= 11.15.0 required; version verified locally)
- Bun 1.3.11 for repository install/test commands
- Channel/version validation: tooling/scripts/assert-release-inputs.mjs —
  name must be @irogane/kaji, private != true, valid semver, latest forbids
  prerelease, next requires prerelease; all four branches tested locally
- Public-version check: npm view <name>@<version> before staging; existing
  version fails; unknown registry errors fail conservatively (tested against
  live registry: 0.0.0 absent -> pass; 0.2.0-beta.11 exists -> fail)
- Package verification gates: bun install --frozen-lockfile, format:check,
  lint, typecheck, test (failure/concurrency semantics included), build,
  package:check (publint + attw), package:smoke (tarball install + runtime +
  strict TS), example:refund (proof lifecycle)
- Stage command: npm stage publish "$STAGED_TARBALL" --tag "$CHANNEL"
  --access public --provenance; followed by a step-summary report (package,
  version, channel, source sha, artifact sha256, stage list, inspect and
  approve/reject commands)
- No-publication guarantee: final workflow action stages only; approval is
  `npm stage approve <stage-id>` interactively with 2FA, outside CI
- External configuration still required (ops/npm-trusted-publishing):
  npm trusted publisher for @irogane/kaji allowing `npm stage publish` only
  from workflow file publish.yml with environment npm-release; GitHub
  Environment npm-release with source restriction to main

## Verification

- actionlint publish.yml: PASS
- assert-release-inputs.mjs: 4/4 branch tests pass (accepted, stable-on-next
  rejected, existing-version rejected against live registry, bad channel
  rejected)
- Workflow pack/validate sequence executed locally: pack -> sha256 ->
  publint ("All good!") -> attw esm-only PASS
- Full repository gate green: format, lint, typecheck, test, build,
  package:check, package:smoke, example:refund
- One transient typecheck failure during the session did not reproduce
  across three subsequent full runs; no code changes between runs
- No staging command was executed; nothing was published (registry still
  shows only 0.2.0-beta.11)

## Remaining

- Merge requires independent review (material release infrastructure).
- Trusted publisher + environment protection live in ops/npm-trusted-publishing.
- First real dispatch requires a version bump commit on main.

## Next

ops/npm-trusted-publishing.
