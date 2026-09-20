# release-0.3.0-rc.1

Branch: release/0.3.0-rc.1 (merged, PR #9; main ca587fe carries the bump)
State: BLOCKED — npmjs.com trusted publisher missing (single external action)

## Goal

First release candidate: @irogane/kaji@0.3.0-rc.1 staged by CI on dist-tag
`next`, inspected and approved by a human with 2FA. Nothing is public.

## Done

- Version bump 0.0.0 → 0.3.0-rc.1 merged to main (PR #9, ca587fe)
- Release gate proven end-to-end in CI on the real artifact: format, lint,
  build, typecheck, full test suite, package validation (publint + attw),
  consumer smoke, refund proof example, release-input assertions,
  pack + sha256 + artifact validation — ALL GREEN in run 35523348098
- Gate-order defect found and fixed on the first real dispatch: the example
  workspace's typecheck resolves @irogane/kaji through dist/index.d.mts, so
  build must precede typecheck in a pristine checkout (PR #10)
- OIDC preflight verified in CI: ACTIONS_ID_TOKEN_* present, GitHub minted
  the npm-audience ID token (PR #11 added explicit pre-check + verbose npm
  logging on the stage step)

## Blocker (exact evidence)

Run 35523348098, Stage package step:

    npm http fetch POST 404 https://registry.npmjs.org/-/npm/v1/oidc/token/exchange/package/@irogane%2fkaji
    npm verbose oidc Failed token exchange request with body message:
    OIDC token exchange error - package not found

"package not found" = the npm registry has no trusted publisher
configuration for @irogane/kaji. Nothing was staged; the registry is
untouched (dist-tags still: beta + latest → 0.2.0-beta.11).

## Required human action (npmjs.com, requires npm login)

Package @irogane/kaji → Settings → Trusted Publisher (GitHub Actions):

- Organization or user: enkyuan
- Repository: kaji
- Workflow filename: publish.yml
- Environment: npm-release

If command scoping is offered, restrict to staged publishing.

Note: the GitHub Environment branch policy (deployment branches → main)
also still reads unset via API — defense in depth only; the workflow
already refuses non-main refs.

## Resume (after the trusted publisher is saved)

    gh workflow run publish.yml -R enkyuan/kaji --ref main -f channel=next

Then watch the run. On success the run summary lists the stage id; inspect
locally (npm stage list/view/download @irogane/kaji) and approve with 2FA
per docs/playbooks/release.md (INSPECT → APPROVE). Verify with the sha256
printed in the run summary.

## Next

User configures the trusted publisher; agent re-dispatches on request.
