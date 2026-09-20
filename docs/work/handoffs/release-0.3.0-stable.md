# release-0.3.0 (stable)

State: DONE — published 2026-09-20; latest resolves to 0.3.0

## Release record

- Package: @irogane/kaji
- Version: 0.3.0 (stable; prerelease suffix removed only — diff vs rc.1 is the version line)
- Dist-tag: latest (moved off 0.2.0-beta.11)
- Release SHA: cc1874a3c98266e9be046a5c73f3e113a5d89fbb (main via PR #15, "chore: prepare 0.3.0")
- Workflow run: 35528245352, channel=latest, all gate steps success
- npm stage: c984942d-877f-4957-b3f7-934538c59f3e (approved by maintainer with 2FA)
- Artifact sha256: 8ed14ae4829ea7f7fff0a26644cdd4df536e9d32811e52aeafe8b8c84bee2947
- Registry integrity: sha512-fz43AY6LFdvaLUQudhoVfAIWpe8VL0Sk8BupS9n3fYMKB0rWvhHvWfI8p8j60sb8Qd9QX51a2tMO/+8X9LQggw== (matches CI artifact)
- Provenance: signed, sigstore transparency log; attestations endpoint live
- Git tag: v0.3.0 (annotated, on the release SHA)
- GitHub Release: https://github.com/enkyuan/kaji/releases/tag/v0.3.0

## Verification (all against the public registry)

- Bare `npm install @irogane/kaji` (no tag) resolves 0.3.0
- JS import + capability smoke: fresh succeeded; duplicate replay recorded
  without re-execution; thrown knownFailure → failed; unrecognized throw → unknown
- Strict TypeScript consumer compile passes
- Bun consumer: registry install, same smoke, TS runs directly — pass

Note: the maintainer's first stage approve did not reach the registry
(registry stayed E404); a re-run published successfully. Stage-approve
output should always be confirmed against `npm view` before treating a
release as public.

## User actions carried forward (npm auth / Cloudflare dashboard)

1. Set CLOUDFLARE_API_TOKEN (Pages: Edit) as repo secret BEFORE the
   docs/npm-live merge, so that apps/docs merge proves auto-deploy E2E.
   Gate-off behavior without the secret is already proven.
2. `npm deprecate @irogane/kaji@0.2.0-beta.11` (old agent SDK; recommended
   in the release-readiness handoff, still pending).
3. Dist-tag normalization: `npm dist-tag add @irogane/kaji@0.3.0 next`
   (no active prerelease train) and `npm dist-tag rm @irogane/kaji beta`.

## Next

docs/npm-live — enable homepage install command, header npm link,
getting-started + README installs now that stable 0.3.0 is on latest.
No docs changes were made in this release task.
