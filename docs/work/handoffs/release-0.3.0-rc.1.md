# release-0.3.0-rc.1

Branch: release/0.3.0-rc.1 (merged, PR #9; main ca587fe carries the bump)
State: STAGED — awaiting human inspection + 2FA approval

## Staged release (run 35526812451, all steps green)

- Package: @irogane/kaji@0.3.0-rc.1
- Stage id: 4c77a58e-c50d-41e1-bf1d-3facb5eb6e57
- Dist-tag: next
- Artifact: irogane-kaji-0.3.0-rc.1.tgz
- Artifact sha256: af72361e6854eca58f782f6e452bc16e8b1da0dbaa9fa31650a20f0a6cabcaff
- Provenance: signed (sigstore transparency log index 2901819288)
- Nothing public until `npm stage approve` (2FA, human only)

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

## Resolution of the earlier blocker

The 404 "package not found" exchange error was fixed by configuring the
trusted publisher on npmjs.com (user, 2026-09-20). Subsequent dispatch
run 35526812451 staged successfully; provenance was signed and recorded
in the sigstore transparency log.

## Required human action (npmjs.com, requires npm login)

Package @irogane/kaji → Settings → Trusted Publisher (GitHub Actions):

- Organization or user: enkyuan
- Repository: kaji
- Workflow filename: publish.yml
- Environment: npm-release

If command scoping is offered, restrict to staged publishing.

## Inspection and approval (human, 2FA)

    npm stage list @irogane/kaji
    npm stage view 4c77a58e-c50d-41e1-bf1d-3facb5eb6e57
    npm stage download 4c77a58e-c50d-41e1-bf1d-3facb5eb6e57
    shasum -a 256 <downloaded>.tgz   # must equal the artifact sha256 above
    npm stage approve 4c77a58e-c50d-41e1-bf1d-3facb5eb6e57   # publishes
    npm stage reject 4c77a58e-c50d-41e1-bf1d-3facb5eb6e57    # discards

After approval, VERIFY PUBLIC REGISTRY per docs/playbooks/release.md,
then FINALIZE (tag v0.3.0-rc.1 on ca587fe, GitHub Release; docs install
UI stays off until stable 0.3.0).
