# Active work

Task: `docs/signed-release-tags`

- State: `REVIEW`
- Owner: implementation
- Branch: `docs/signed-release-tags`
- Worktree: `/Users/enkyuan/Desktop/Projects/kaji-wt/docs-signed-release-tags`
- Base SHA: `56248865fe634994c60c51c0808dcfa59018e5a2`
- Goal: Make signed release tags a durable contract — local signing default plus playbook requirement.
- Package source diff: none
- Public API diff: none

## Scope

- Repo git config: `tag.gpgsign true` (applied outside this branch).
- `docs/playbooks/release.md`: FINALIZE uses `git tag -s` + `git tag -v` before push; new invariant under `## Invariants`.

## Exit condition

PR merged into `main`, worktree removed, branch deleted.

Handoff: `docs/work/handoffs/docs-signed-release-tags.md`
