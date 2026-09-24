# docs/signed-release-tags

State: REVIEW
Branch: `docs/signed-release-tags`
Base SHA: `56248865fe634994c60c51c0808dcfa59018e5a2`
Worktree: `/Users/enkyuan/Desktop/Projects/kaji-wt/docs-signed-release-tags`

## Goal

Make "all release tags are signed" durable: every future release tag must be a GPG-signed annotated tag that GitHub verifies.

## Decisions

- Two layers, user-approved (O1-1): a repo-local git signing default and a release playbook contract change.
- `tag.gpgsign true` is set in the repository's common git config (`/Users/enkyuan/Desktop/Projects/kaji/.git/config`), so plain `git tag` in any worktree of this clone produces a signed tag. Verified with a throwaway annotated tag whose object contains a PGP signature.
- `docs/playbooks/release.md` FINALIZE now requires `git tag -s`, `git tag -v` before push, and adds the signing invariant under `## Invariants`.
- The three existing remote tags (`v0.3.0`, `v0.3.0-rc.1`, `v0.3.1`) were re-signed in the prior task; GitHub reports `verified=true` for all three. This change prevents regression on the next release.

## Changed

- `.git/config` (repo-local): `tag.gpgsign true` — not part of this branch; already applied.
- `docs/playbooks/release.md`: FINALIZE step 1 and the Invariants list.
- `docs/work/active.md`: now records this task.

## Verification

- `git config --show-origin --get tag.gpgsign` → repo config, `true`.
- Probe: `git tag probe -m` produced an object containing `BEGIN PGP SIGNATURE` (`git tag -v` reported a good signature); probe deleted.
- Playbook commands exercised this session: `git tag -s`, `git tag -v` (good signature), scoped forced tag-ref push; GitHub API reports `verification.verified=true` for all three release tags.

## Remaining

None known. The signing default lives in the local clone's git config; clones elsewhere rely on the playbook contract.

## Next

Review and merge `docs/signed-release-tags`; then remove the worktree and delete the branch.
