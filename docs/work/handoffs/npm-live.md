# docs/npm-live

Branch: docs/npm-live (merged as PR #17)
Goal: Enable stable npm installation UI after public registry verification.

## Registry verification (precondition, checked fresh)

- @irogane/kaji@0.3.0 exists on the public registry
- dist-tags: latest == 0.3.0 (next == 0.3.0-rc.1, beta == 0.2.0-beta.11)
- Bare `npm install @irogane/kaji` in a clean project resolves 0.3.0

## Changed files (exact)

1. apps/docs/src/pages/index.astro — restored the entry-install block
   (single command, kept .entry-install CSS + auto copy-button surface):
   `npm install @irogane/kaji`; added an `npm` entry button linking to
   https://www.npmjs.com/package/@irogane/kaji
2. apps/docs/src/layouts/docs.astro — `npm` link in the doc-actions header
   on all doc pages
3. apps/docs/content/getting-started.mdx — intro no longer claims the
   package is unpublished; Install section now `npm install @irogane/kaji`
   + `npm install zod` (was repo-workspace `bun install`)
4. packages/ts/README.md — gating paragraph replaced by the real install
   command block

No package implementation, version, or publish action. No hardcoded
version in install commands. No release-announcement chrome.

## Verification

- Registry: latest==0.3.0, bare install 0.3.0 (fresh /tmp project)
- Docs checks: format, lint, typecheck, build all pass
- Cross-workspace: build + typecheck + package:smoke + example:refund pass
  (pristine-checkout typecheck requires build first — known condition)
- Content: zero matches for "not yet published", beta.11, 0.3.0-rc, @next
  across apps/docs and README; only npm URL is the real package page
- Deploy: CLOUDFLARE_API_TOKEN secret was set before merge, so PR #17's
  merge ran docs-site.yml run 35529552000 with "Deploy to Cloudflare
  Pages" = success — END-TO-END AUTO-DEPLOY PROVEN (no manual wrangler)
- Live checks on https://kaji.build: homepage carries the install command
  and npm link; /docs/getting-started/ carries install + zod commands and
  the npm header link; zero stale references (verified with markup
  stripped — Shiki tokenizes code blocks into spans, so plain-text grep
  under-reports)

## Remaining (user, npm-auth)

- npm deprecate @irogane/kaji@0.2.0-beta.11 (old agent SDK)
- Dist-tag cleanup: `npm dist-tag add @irogane/kaji@0.3.0 next`,
  `npm dist-tag rm @irogane/kaji beta`

## Next

Normal development. Release train 0.3.0-rc.1 → 0.3.0 is fully closed.
