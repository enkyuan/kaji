# @kaji/docs

Public documentation for Kaji, built with [Astro](https://astro.build).

## Local development

```bash
# from repo root
bun --filter @kaji/docs dev

# or from this directory
bun dev
```

Open [http://localhost:3000](http://localhost:3000).

## Structure

| Path                         | Purpose                                |
| ---------------------------- | -------------------------------------- |
| `src/pages/index.astro`      | Landing page                           |
| `src/pages/docs/`            | Static documentation routes            |
| `content/`                   | MDX pages                              |
| `src/components/content/`    | MDX primitives and page behavior       |
| `src/components/navigation/` | Desktop, mobile, and page navigation   |
| `src/components/site/`       | Brand, footer, and landing demo        |
| `src/content.config.ts`      | Astro content collection schema        |
| `src/data/navigation.ts`     | Documentation information architecture |
| `src/styles/global.css`      | Agentation-derived visual system       |

## Content contracts

Documentation lives in `content/`. The collection schema in
`src/content.config.ts` controls frontmatter and page metadata.

Every code example should reflect the actual public API of
`@irogane/kaji`. Do not document a symbol that is not exported from
`packages/ts/src/index.ts`.

## Checks

```bash
bun run build      # production build
bun run typecheck  # Astro diagnostics
bun run lint       # oxlint
bun run format:check
```
