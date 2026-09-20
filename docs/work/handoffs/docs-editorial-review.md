# docs/editorial-review

State: DONE
Branch: `docs/editorial-review`
Base SHA: `21b40c3fd51d4ddb7ebc97e00ae26691f19b96d5`
Worktree: `/Users/enkyuan/Desktop/Projects/kaji-wt/consolidate-main`

## Goal

Make the root README canonical. Rewrite every public documentation page for technical accuracy, clarity, compression, and consistent terminology.

## Constraints

- Preserve the finalized public API. Package source diff: zero.
- Preserve package behavior and product semantics.
- Use the six public status literals exactly: `succeeded`, `denied`, `rejected`, `failed`, `cancelled`, `unknown`.
- Keep the npm package README byte-identical to the root README.
- Preserve the visual system unless presentation blocks comprehension. No visual/animation changes made.

## Result model (verified against `packages/ts/src`)

`succeeded`, `denied`, `rejected`, `failed`, `cancelled`, `unknown`. `knownFailure()` is one path to `failed`; an idempotency conflict is the other. `unknown` means Kaji cannot prove whether the side effect committed.

## Canonical README and sync mechanism

`README.md` at the repository root is canonical. `packages/ts/README.md` must stay byte-identical.

Mechanism: `package.json` script `readme:check` runs `cmp -s README.md packages/ts/README.md` and fails with a corrective message on drift. Wired into `bun run package:check` (root) and into `.github/workflows/typescript-package.yml` as its own CI step, so a PR that edits one README without the other fails CI before merge. No generator, symlink, or build-time copy was introduced, per the "smallest reliable mechanism" instruction.

Verified: `bun run readme:check` passes; `cmp README.md packages/ts/README.md` reports identical; `npm pack --dry-run` in `packages/ts` includes a 7.3kB `README.md` matching the root file.

## Terminology decisions (durable)

- Canonical status term for the classification model: "result status" / the six-value `ExecutionResult.status`. Never introduced `COMPLETED`/`FAILED`/`UNKNOWN` as a three-value model; the implemented six-value enum is authoritative over the task brief's assumed three-value model.
- "capability" for the declared action, "execution" for one governed call, "application action" for the caller-facing concept, "principalId" (never "user"/"actor"/"subject" as a substitute term).
- "idempotency key" (caller-supplied, never Kaji-generated) and "execution identity" for the (capability, principalId, idempotencyKey) tuple.
- "unknown" always refers to the literal status; never described as "the request failed" or "an error."
- "known failure" / `knownFailure()` described narrowly: valid only when application code has proof no side effect committed. Never described as retryable, permanent, or a general error wrapper.
- "cooperative" for cancellation/timeout behavior — Kaji cannot forcibly stop `execute()`.
- Caller-neutral framing: "agents, automations, and other callers" / "application action," not agent-exclusive language, throughout README and homepage.

## Pages reviewed and rewritten

- Root `README.md` / `packages/ts/README.md` (synchronized, byte-identical)
- `apps/docs/content/index.mdx` (docs landing)
- `apps/docs/content/architecture.mdx`
- `apps/docs/content/getting-started.mdx`
- `apps/docs/content/troubleshooting.mdx`
- `apps/docs/content/concepts/capability.mdx`
- `apps/docs/content/concepts/authorization.mdx` (new page)
- `apps/docs/content/concepts/executor.mdx`
- `apps/docs/content/concepts/approval.mdx`
- `apps/docs/content/concepts/outcomes.mdx` (new page)
- `apps/docs/content/concepts/idempotency.mdx`
- `apps/docs/content/concepts/stores.mdx` (new page)
- `apps/docs/content/concepts/cancellation.mdx`
- `apps/docs/content/reference/api.mdx` (new page, replaces prior inline API prose)
- `apps/docs/content/reference/refund-example.mdx` (new page)
- `apps/docs/src/pages/index.astro` (homepage: definition and install copy only; no visual change)
- `apps/docs/src/pages/introduction.astro` (rewritten as the single canonical "what is Kaji" page)
- `apps/docs/src/data/navigation.ts` (added Authorization, Outcomes, Stores, API Reference, Refund Example entries)
- `apps/docs/src/components/navigation/sidebar.astro`, `footer.astro`, `layouts/docs.astro`, `pages/404.astro`: corrected stale `enkyuan/alloy` GitHub links to `enkyuan/kaji`; removed stale "(pre-release)" version label; reworded 404 CTA
- `docs/api.md`, `docs/invariants.md`: corrected to match implemented six-status model, cooperative timeout behavior, and non-persisted approval evidence
- `packages/ts/package.json`: corrected `description` field from agent-exclusive, "safely"-qualified language to caller-neutral wording consistent with the README/docs (mechanical metadata fix, not a behavior or API change)

## Significant edits (conceptual summary)

- Replaced an assumed `COMPLETED`/`FAILED`/`UNKNOWN` three-state model with the implemented six-status model everywhere; this was a correction toward the actual API, not a new design decision.
- Removed all "seamless," "robust," "safe," and similar unearned-claim language from public prose in favor of direct mechanism statements (e.g., "Kaji atomically claims an idempotency key" rather than "Kaji guarantees exactly-once execution").
- Made the `memoryStore()` non-durability caveat appear once per surface (README, docs landing, Getting started, Stores) rather than with inconsistent wording across pages.
- Corrected a documentation-contract defect: prior docs implied `timeoutMs` bounds `execute()` wall-clock time. The shipped behavior aborts `context.signal` but keeps awaiting `execute()` until it settles. All timeout/cancellation prose (README, architecture, executor, cancellation, troubleshooting, api.md, invariants.md) now states this precisely and consistently.
- Corrected a second documentation-contract defect: prior docs implied Kaji retains or exposes approval evidence. The implementation accepts `decision.evidence` but never persists or exposes it. All approval prose was corrected accordingly, with the application approval system stated as the owner of audit evidence retention.
- Added dedicated pages for Authorization, Outcomes, Stores, API Reference, and the Refund Example so each concept has one canonical, complete explanation instead of being folded into other pages; cross-references replace duplicated re-explanation.
- Removed all stale `enkyuan/alloy` links (prior repository name) from docs site chrome; confirmed zero remaining "alloy"/"Alloy" references anywhere in the reviewed public files.

## Deleted/reduced content

- Removed repeated inline API prose from multiple concept pages in favor of one canonical API Reference page, linked from elsewhere.
- Removed duplicate `memoryStore()` disclaimers that previously used slightly different wording per page; now one canonical sentence, reused verbatim or linked.
- Removed the "(pre-release)" sidebar label, which was stale relative to the published `0.3.1` state.

## Technical ambiguities discovered

One release-blocking product defect was found and intentionally kept out of the public contract, per the "documentation is not authoritative when it conflicts with implementation" rule and the "do not fix product semantics in this branch" constraint:

**F5 — unsettled claim on a throwing `approval()` predicate.** If a capability's `approval` predicate throws, the execution claim is left unsettled (Kaji never calls `store.record()` for that claim), so an identical retry can wait indefinitely on `ClaimResult.existing.outcome`. This is not documented as part of the public contract. It requires a dedicated runtime task (failing regression test first, explicit terminal-status decision, duplicate-retry coverage) before the next package release. No runtime change was made in this branch.

No other implementation/documentation disagreement was found. Every code example was checked directly against `packages/ts/src/index.ts`, `capability.ts`, `kaji.ts`, `execution/*.ts`, `store/*.ts`, and `errors.ts`.

## Verification performed

```
bun install --frozen-lockfile        pass
bun run format:check                 pass (32 ts files, 33 docs files, 4 example files)
bun run lint                         pass (0 warnings, 0 errors across all workspaces)
bun run typecheck                   pass (0 errors; 1 pre-existing unrelated hint in base.astro)
bun run test                        pass (11 files, 88 tests)
bun run build                       pass (17 static routes incl. llms.txt/llms-full.txt)
bun run readme:check                pass (root and package README byte-identical)
bun run package:check                pass (readme:check + tsdown build + publint + attw)
bun run package:smoke               pass
bun run example:refund              pass (succeeded / replay / unknown / failed cases all proven)
npm pack --dry-run (packages/ts)     pass (tarball contains 7.3kB README.md matching root)
npm view @irogane/kaji               confirmed: version 0.3.1 live, dist-tag latest -> 0.3.1
```

Every public page was read rendered-content-equivalent (source MDX/Astro read in full) and cross-checked against source types. Internal doc links (`/docs/...`, `/introduction`) were grep-verified against the built route list. No broken internal links found. No remaining `alloy`/`Alloy` references found in any reviewed file.

## Independent review

An independent adversarial review was run via a separate subagent session with no prior conversation context, given only the repository files and told to cross-check against `packages/ts/src`. Full findings recorded below by disposition.

### Fixed

- **Doc/code mismatch in cancellation checkpoints.** `cancellation.mdx` listed 4 pre-execution signal checks (claim, authorization, approval, execution) but `execution/execute.ts` also checks the signal before input validation. Added the missing checkpoint so the documented order matches `executeCapability()` exactly.
- **Conflicting execution-order step counts.** `architecture.mdx` listed 8 steps by folding claim-branch outcomes (existing/conflict) into the linear sequence; `README.md` and `executor.mdx` used 6. Rewrote `architecture.mdx` to state the same 6-step linear order and describe the claim's two branch outcomes separately, so all three pages now decompose the same process identically.
- **Undefined `refundPayment` call shadowing the capability name.** `cancellation.mdx`'s opening example called an undefined `refundPayment(...)` function inside a capability also named via `refundPayment`. Replaced with `provider.refund(...)`, consistent with the pattern used in `idempotency.mdx` and `outcomes.mdx`.
- **Incomplete `replay` example.** `refund-example.mdx` referenced `replay` in an assertion without showing its assignment. Added the `kaji.execute()` call, verified verbatim against `examples/refund/src/app.ts`.
- **README/homepage exclusion-list mismatch.** `README.md` lists nine things Kaji is not; `introduction.astro` listed only five, silently dropping "approval product," "distributed lock service," and "event store." Expanded the homepage list to match the README's scope exactly.
- **Undefined `MCP tool` term.** Removed from `apps/docs/content/index.mdx`; the docs already use "agent, automation, or other caller" consistently elsewhere, so the outlier term was dropped rather than defined, per the existing terminology inventory.
- **`docs/api.md` predicate name inconsistency.** Its `knownFailure()` example used `isDefinitelyDeclined`, the only file diverging from `providerRejectedBeforeCommit` used consistently in README, outcomes.mdx, and troubleshooting.mdx. Aligned it.
- **Undefined-identifier examples in `getting-started.mdx`.** Added one clarifying sentence before each of the two illustrative-only blocks ("Handle the result," "Add approval when required") stating that they extend the earlier working example and that named helpers stand in for application code, rather than silently presenting unresolvable identifiers as runnable.
- **"Lost acknowledgement" used before definition.** `refund-example.mdx`'s summary list used the term before the later section defined it. Rewrote the summary item to be self-contained.
- **`packages/ts/package.json` description.** Corrected from agent-exclusive, unqualified "safely" language to caller-neutral wording matching the corrected README (mechanical metadata fix; not covered by the review but found during source cross-checking).

### Reviewed and retained (not defects)

- **Approval threshold drift (`>= 1_000` vs `>= 500`).** `refund-example.mdx`'s `500` is correct: it documents the real `examples/refund/src/app.ts`, verified byte-for-byte. `getting-started.mdx`, `approval.mdx`, and `capability.mdx` use `>= 1_000` for an illustrative, non-runnable capability. Different values are appropriate because one path documents real code and the other is illustrative; this is not drift.
- **"Atomic enough" phrasing in `stores.mdx`.** Flagged as vague, but the sentence states the exact falsifiable property a store must satisfy ("concurrent identical callers produce exactly one `claimed` result"). Kaji intentionally does not mandate a specific locking mechanism; prescribing one would overstate the contract.
- **"Kaji fails closed" in `getting-started.mdx`.** Flagged as an overgeneralized guarantee, but the sentence is immediately followed by "Missing, invalid, rejected, or failed approval prevents capability execution," which scopes it to approval. Consistent with the equivalent, more detailed statement in `approval.mdx`.
- **Repeated `memoryStore()` non-durability caveat and six-status list across surfaces.** Flagged as duplication, but README is deliberately compressed (per the README role standard) while docs pages are expanded; each restates the same fact in the minimum words needed for that page's self-containedness, and no restatement contradicts another. Reduced further only where a page could cross-reference instead of restate (see "Fixed").
- **`ExecutionEvidence`/`StoredExecution` framing.** Flagged as introducing abstractions without clear necessity. Both are real public exports required for callers implementing a custom `ExecutionStore` or reconciling `unknown` outcomes; `docs/api.md` states the export rationale directly ("public only because custom stores must implement the contract").
- **"Control plane" jargon in README.** Retained: used correctly in a list contrasting what Kaji does not require ("a Kaji server, database, or control plane"), and the target audience (engineers, technical founders) is assumed to know this term without a definition, consistent with the task's instruction to write for an experienced audience.
- **capability.ts source comment "execute...safely."** The internal source doc-comment overstates in isolation, but the phrase never appears in any public documentation page (grep-verified), so it does not propagate into the public contract. Left unchanged because the task requires zero package source diff and this is a comment inside `packages/ts/src`, not a documentation file.

### Reader-test outcome after fixes

- ENGINEER: the undefined-identifier concern in Getting Started was the main blocker; now annotated so the guide is honest about which blocks are runnable versus illustrative, and the three-block define/create/execute sequence was already fully self-contained and verified to compile conceptually against the actual exports.
- FOUNDER: the exclusion-list mismatch between README and the homepage was the main gap; now resolved to identical scope.
- LLM: "whether Kaji retries automatically" was flagged as requiring inference rather than a direct quote. `troubleshooting.mdx` states "Do not blindly retry" and "It does not call the capability again" in multiple places (idempotency, outcomes) but never states "Kaji never retries automatically" as a single direct sentence. Left as-is: every retry-adjacent sentence in the docs is about the *caller's* retry behavior, because Kaji itself has no retry mechanism to describe — there is no code path where Kaji, as opposed to the caller, initiates a second attempt. Adding a sentence denying a nonexistent mechanism would be filler; the "What Kaji is not" list already states "Not a retry service" as the direct claim.


## Remaining

1. Open a separate `fix/` task for the F5 unsettled-claim defect with a failing regression test, before the next package release.
2. Consider (not required by this task's scope) aligning `docs/product.md`'s one-sentence definition ("safely turns...") with the corrected, unhedged mechanism-first language used in the public surfaces — flagged as an observation only, since `docs/product.md` is not one of the three public surfaces this task governs.

## Next

Merge `docs/editorial-review`, then open the F5 regression-test task before the next `@irogane/kaji` release.
