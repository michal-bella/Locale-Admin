---
name: project-standards
description: Lint, format, typecheck, naming and secrets rules for the Locale Admin repo. Use before finishing any change, when a lint/typecheck/secretlint check fails, or when unsure about naming or file layout conventions.
---

# Project standards

## Checks

Run from the repo root (Node from `.nvmrc`: `nvm use`; pnpm via corepack).

| Command           | What it does                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------- |
| `pnpm lint`       | `prisma generate` (type-aware lint needs the Prisma client), ESLint over the whole repo, `prettier --check .` |
| `pnpm lint:fix`   | ESLint `--fix` + `prettier --write .`                                                                         |
| `pnpm typecheck`  | `tsc --noEmit` in every workspace package                                                                     |
| `pnpm secretlint` | scans all files for secrets                                                                                   |
| `pnpm verify`     | lint + typecheck + secretlint + unit + integration tests. Must pass before a step is done                     |

There is one ESLint config (`eslint.config.js`) and one Prettier config (`prettier.config.js`) in the root. Module-specific rules are separate blocks in the root ESLint config scoped by `files` (e.g. React rules only for `frontend/**`). Always lint from the root. ESLint and Prettier skip `.claude/worktrees/` (Claude Code worktrees nested in the repo, each linted from its own root); Prettier also skips the local `.claude/launch.json`.

## Formatting

Tabs (width 4), no semicolons, single quotes (also in JSX), trailing commas, print width 160. YAML uses 2 spaces. Never hand-format; run `pnpm lint:fix`.

## TypeScript

- TypeScript **6.0.3** (not 7: `typescript-eslint` does not support it yet, see `docs/decisions/0003-typescript-6.md`).
- Strict mode, `noUncheckedIndexedAccess`, `verbatimModuleSyntax` (use `import { type X }` for type-only imports; ESLint fixes it).
- `@typescript-eslint/no-deprecated` is an error: use the replacement the deprecation note names (`tsc` alone does not report deprecated APIs).
- Use `type`, never `interface` (lint rule).
- Enums and enum members are `UPPER_CASE` with string values: `enum ERROR_CODE { NOT_FOUND = 'NOT_FOUND' }`.
- Constants are `UPPER_CASE`, objects with `as const`.

## Imports

Order is enforced by `import-x/order`: builtin, external, `@locale/*`, `@/*` and relative parents, siblings, then types; blank line between groups, alphabetical. Run `pnpm lint:fix` instead of ordering by hand. `lodash` is banned.

## Naming

| Thing                           | Convention                                                            | Example                               |
| ------------------------------- | --------------------------------------------------------------------- | ------------------------------------- |
| React component file and folder | PascalCase                                                            | `atoms/Button/Button.tsx`             |
| Props / local types file        | `types.ts`                                                            | `atoms/Button/types.ts`               |
| Hook                            | camelCase `useXxx`, one per file                                      | `hooks/useLocale.ts`                  |
| Other modules                   | camelCase                                                             | `lib/formatDate.ts`                   |
| Backend layers                  | `<area>.<layer>.ts`                                                   | `health.routes.ts`, `auth.service.ts` |
| Test                            | `*.test.ts(x)` next to the code; integration tests in `backend/test/` |                                       |

## Secrets

- Never commit real secrets. Real values live only in `.env` (gitignored).
- `.env.example` contains local-only values; the dev DB password `locale_dev_password` is allowlisted in `.secretlintrc.json`. Do not allowlist anything else without the user's approval.
- secretlint runs in `pre-commit` (staged files) and in `pnpm verify` (all files). It ignores AWS documentation example keys (`…EXAMPLE…`), so test it with a realistic-looking fake key.

## Dependencies

- Add with exact versions: `pnpm --filter <pkg> add -E <name>@<version>`.
- `pnpm-workspace.yaml` sets `minimumReleaseAge: 20160` (14 days). pnpm refuses newer versions; pick the newest version older than 14 days.
- Packages with install scripts must be listed in `allowBuilds` in `pnpm-workspace.yaml` (`true` to allow, `false` to deny). Use `pnpm approve-builds <pkg>` or `'!<pkg>'`.
