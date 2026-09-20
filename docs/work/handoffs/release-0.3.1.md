# release/0.3.1

State: DONE — published and verified 2026-09-20
Goal: Make the npmjs package page reflect the current package README.

## Why a release

The published 0.3.0 tarball carried the pre-release gating README
(published 14:20; the README-restoring PR #17 merged 14:35). npm package
metadata is immutable per version, so a patch release was the only way to
update the npmjs page. Minimal-patch-from-0.3.0-SHA was not an option:
publish.yml stages from main only, by design.

## Decisions

- 0.3.1 cut from main tip (2c66019, PR #23 merge) with version bump only
- Code-delta disclosure given before approval: tarball diff vs 0.3.0 is
  README (requested fix) + version fields + //#region bundler source-path
  comments from the PR #19 reorganization; executable lines and
  declarations byte-identical
- next dist-tag left at 0.3.0 (no active prerelease train; latest is
  newer than next, which npm tolerates)

## Verification

- Stage id ab215e2d-6f15-488b-ac35-608e10454330 (run 3552370580, all steps
  success); approved by user with 2FA
- Artifact sha256 4ad0edafa94cc5b2b880fe2f881be14dca4fd79891ab0fc36942790aa4e1fc67;
  registry dist.integrity sha512-wBc0UZMQj3WDwsf8d8vaIqWNFlD5oERXGev3zHH4O3EsykeqwIBhMzD5Z6fwX8iaQJe2sfNwnPNc00bsjGVjjw==
  recomputed locally from the same tarball — match
- Post-publish: latest=0.3.1, next=0.3.0; published README shows the plain
  install command; 0 matches for gating text or dead links
- Bare npm install resolves 0.3.1; JS smoke: fresh=succeeded, replay
  returns recorded execution (no re-execution)
- Tag v0.3.1 annotated at 2c66019; GitHub Release created with artifact
  + provenance record

## Remaining

None.

## Next

Normal development.
