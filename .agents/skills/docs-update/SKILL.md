---
name: docs-update
description: When and how to update the human documentation in docs/ (Slovak, Markdown that will be synced to Notion). Use in every step that changes an endpoint, data model, ENV variable, Docker service or makes a decision.
---

# Docs update

`docs/` is the source of truth for people (team, PM) and will be synced to Notion later (read-only copy). `AGENTS.md` and skills are for agents; link, do not duplicate.

## When

Update the matching page in the same commit as the code:

| Change                                     | Page                                                                              |
| ------------------------------------------ | --------------------------------------------------------------------------------- |
| endpoint added or changed                  | `docs/api/<area>.md` + table in `docs/api/README.md`                              |
| Prisma model or migration                  | `docs/database.md` (table + Mermaid ER diagram)                                   |
| ENV variable, script, Docker service, port | `docs/local-development.md`, `docs/architecture.md`                               |
| FE routing, layout, theme, i18n            | `docs/frontend.md`                                                                |
| test setup or commands                     | `docs/testing.md`                                                                 |
| decision with alternatives                 | new ADR `docs/decisions/NNNN-<kebab-name>.md` + row in `docs/decisions/README.md` |
| finished milestone or phase                | `docs/changelog.md`                                                               |

## Format rules (Notion import)

- One file = one Notion page. Start with YAML frontmatter:
    ```yaml
    ---
    title: 'Názov stránky'
    updated: YYYY-MM-DD
    notion_page_id:
    ---
    ```
    Quote `title` (titles like `0003: TypeScript` are invalid YAML unquoted). Update `updated` when the content changes. Leave `notion_page_id` empty.
- Standard Markdown only: headings, lists, tables, code blocks, links. No HTML, no tool-specific syntax.
- Diagrams as ` ```mermaid ` code blocks.
- Links between pages are relative (`./api/health.md`).
- No secrets, passwords or real personal data (use `meno@firma.sk` style examples).
- Language: Slovak.
- `docs/plans/` holds phase plans; they are not synced to Notion.
- Run `pnpm lint:fix` (Prettier formats tables).

## ADR template

```markdown
## Kontext

## Rozhodnutie

## Dôsledky
```
