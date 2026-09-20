# npm-trusted-publishing

Branch: chore/npm-release-infra (PR #7 open; this file added there)
Task base state: publish.yml exists on this branch, not yet on main
State: BLOCKED (external actions required; nothing staged or published)

## Goal

Establish the trust path: GitHub repository → publish.yml → Environment
npm-release → GitHub OIDC → npm trusted publisher → npm stage publish only.
No long-lived npm publishing token.

## GitHub repository configuration (DONE)

- Environment `npm-release` CREATED via API
  (PUT /repos/enkyuan/kaji/environments/npm-release).
- protection_rules: [] — deliberate. Single-maintainer repository; a fake
  reviewer requirement would block releases. npm 2FA stage approval remains
  the final human gate (docs/playbooks/release.md APPROVE).
- Environment secrets: 0. Repository secrets: 0 (gh secret list empty,
  re-verified). No npm token exists anywhere.

## Workflow identity (VERIFIED against branch state)

- publish.yml line 43: `environment: npm-release`
- publish.yml line 31: `id-token: write`; workflow-level permissions are
  contents: read + id-token: write only
- publish.yml main-only guard is the first step (GITHUB_REF_NAME check)
- Executable `npm publish` (non-stage) appears nowhere in .github/workflows;
  the only publish-forms outside `npm stage publish` are comment text
- OIDC claims npm will receive at dispatch from main:
  job_workflow_ref = enkyuan/kaji/.github/workflows/publish.yml@refs/heads/main,
  environment = npm-release
- Exact trusted-publisher values to enter on npm: repository enkyuan/kaji,
  workflow publish.yml, environment npm-release

## Token audit (DONE, clean)

- Searched repo and workflows for NPM_TOKEN, NODE_AUTH_TOKEN,
  NPM_PUBLISH_TOKEN, NPM_AUTOMATION_TOKEN: zero matches (the only
  CLOUDFLARE_API_TOKEN reference is the gated docs deploy step).
- npm local auth: none (npm whoami 401) — no local publish credential.

## BLOCKERS (manual actions)

1. RESOLVED: PR #7 merged 2026-09-20; main 15a6f65 contains publish.yml.
   npm trusted-publisher validation against the default branch is now
   possible. Merge-triggered Docs site and TypeScript package workflows
   completed successfully.
2. Environment branch policy: deployment_branch_policy is null (API
   returned 404 — token lacks the administration scope for
   deployment-branch-policies; retried after environment creation and
   again after the PR #7 merge). Set via UI: Settings → Environments →
   npm-release → Deployment branches and tags → Selected branches and
   tags → `main`.
3. npm trusted publisher (npmjs.com → @irogane/kaji → Settings →
   Trusted Publisher, requires npm login): GitHub Actions, repository
   enkyuan/kaji, workflow filename publish.yml, environment npm-release.
   npm's UI offers command-level scoping for trusted publishers when
   available; prefer stage-publish-only if presented. Do not configure
   direct npm publish as an authorized command.
4. Verify package 2FA policy on npmjs.com: @irogane/kaji → Settings →
   require two-factor authentication for publishing (auth-and-writes).
   Trusted publishing is not blocked by 2FA; human `npm stage approve`
   always requires 2FA.

## Verification ledger

- npm whoami: 401 (not authenticated locally)
- PUT environment npm-release: 201-equivalent success
- GET environment: name npm-release, protection_rules [], deployment_branch_policy null
- GET environment secrets: []
- gh secret list: empty
- publish.yml environment/id-token greps: exact matches above
- Nothing staged, published, tagged, or version-changed.

## Next

release/0.3.0-rc.1 — only after all four blockers are confirmed complete.
