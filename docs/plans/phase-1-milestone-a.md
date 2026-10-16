---
title: Fáza 1 – implementačný plán míľnika A
updated: 2026-10-16
notion_page_id:
---

# Fáza 1 – implementačný plán míľnika A (Základ)

Rozpracovanie míľnika A z [phase-1.md](./phase-1.md). Po každom kroku nasleduje checkpoint: feedback loop, aktualizácia `docs/`, commit a krátky report.

## Overené verzie (2026-10-16)

Pravidlo: najnovšia stabilná verzia staršia ako 2 týždne (ochrana pred čerstvo vydanými, ešte neoverenými releasmi). Verzie sa zafixujú presne (bez `^`).

| Oblasť | Verzia | Poznámka |
|---|---|---|
| Node | 24 LTS (`24.12.0` lokálne, image `node:24-bookworm-slim`) | Vite+ vyžaduje `^24.11.0` |
| pnpm | 12.8.2 | cez `packageManager` + corepack |
| Vite+ | 1.0.0 (MIT, stabilná) | `vp dev` / `vp build` / `vp test`, config `vite.config.ts` cez `vite-plus` |
| TypeScript | **6.0.3** | TS 7 (natívny) zatiaľ nepodporuje `typescript-eslint` (`<6.1.0`), viď ADR |
| React | 19.3.0 | |
| Mantine | 9.6.3 | |
| Tailwind | 4.3.3 | CSS layers kvôli Mantine |
| TanStack Query / Router | 5.104.0 / 1.170.41 | |
| react-i18next / i18next | 17.0.15 / 26.4.2 | |
| zod | 4.6.5 | |
| Express | 5.2.1 | |
| Prisma | 7.10.0 + `@prisma/adapter-pg` | `prisma.config.ts`, generátor `prisma-client`, ESM |
| Postgres | 17 (alpine) | |
| ESLint / typescript-eslint / Prettier | 10.11.0 / 8.71.0 / 3.9.9 | |

## Rozhodnutia pre míľnik A

- **Router: TanStack Router (code-based routes).** Typovo bezpečné routy a `beforeLoad` guardy, ktoré sa priamo napoja na TanStack Query (`ensureQueryData` pre `/auth/me` v míľniku B). Code-based namiesto file-based: aplikácia má málo rout a odpadá generovaný súbor aj ďalší Vite plugin. ADR `0002`.
- **TypeScript 6.0.3** namiesto 7.0. ADR `0003`.
- **Vite+ iba vo `frontend/`.** Lint a format robí ESLint + Prettier podľa plánu, nie `vp lint` / `vp fmt` (Oxlint/Oxfmt). ADR `0001`.
- **Backend testy:** samostatný Vitest (rovnaká major verzia ako vo Vite+), backend nie je Vite projekt.
- **Bootstrap výnimka:** kroky A1 a A2 (harness, kostra balíkov, root konfigurácie) robí orchestrátor sám, lebo role ešte neexistujú. Od kroku A3 sa kód vo `frontend/` a `backend/` robí cez rolových subagentov vo vlastných worktree podľa `.agents/workflows/feature.md` (zároveň prvý test subagent flow).

## Kroky

### A1. Harness kostra

- Root `AGENTS.md`, `frontend/AGENTS.md`, `backend/AGENTS.md`, `packages/shared/AGENTS.md`, `e2e/AGENTS.md`.
- `.agents/agents/` (orchestrator, frontend-developer, backend-developer, e2e-tester, code-reviewer), `.agents/workflows/feature.md`.
- `.agents/skills/` iba vymenované v root `AGENTS.md` (žiadne prázdne kostry).
- Adaptéry: `CLAUDE.md` (`@AGENTS.md`), `.claude/skills` symlink, `.claude/agents/*.md` (frontmatter + jedna veta). Cursor a Codex podľa aktuálnej dokumentácie.
- `scripts/agents/check-scope.sh`.
- Kostra `docs/` so všetkými stránkami a frontmatterom, ADR 0001–0003.
- **Overenie:** `check-scope.sh` funguje na testovacej vetve (povolená aj zakázaná cesta), symlinky sú platné, každý `docs/*.md` má frontmatter.

### A2. Monorepo + kvalita kódu

- `pnpm-workspace.yaml`, `.nvmrc`, `.editorconfig`, `.gitignore`, `.env.example`.
- Balíky `frontend`, `backend`, `packages/shared`, `e2e` s minimálnym obsahom.
- Root ESLint (flat config) + Prettier, `tsconfig.base.json` (strict).
- husky + lint-staged, commitlint, secretlint (allowlist pre lokálne dev hodnoty).
- Root skripty zo sekcie 2 (tie, ktoré ešte nemajú čo spúšťať, skončia s jasnou hláškou).
- **Overenie:** `pnpm lint`, `pnpm typecheck`, `pnpm verify` prejdú. Commit `fix stuff` zablokuje `commit-msg`. Commit s testovacím AWS kľúčom zablokuje `pre-commit`.

### A3. Kontrakt + Docker, DB, Prisma, seed, health (BE) a FE kostra – paralelne

1. **Kontrakt (orchestrátor):** v `packages/shared` schéma `HealthResponse`, `ErrorCode`, `ValidationCode`, pravidlá hesla, schéma ENV pre seed. Merge do `main`.
2. **Backend Developer (worktree):** Express 5 cez `createApp(config)`, validácia ENV zodom v `server.ts`, pino, helmet, chybový middleware podľa kontraktu (404 `NOT_FOUND`, 500 `INTERNAL_ERROR`), Prisma schéma `User` + `Session`, migrácia, idempotentný seed, `GET /api/health` so stavom DB, test DB `locale_test` a integračné testy pre health a seed.
3. **Frontend Developer (worktree):** Vite+ app, Mantine theme z Figmy (farby, font, radius), DM Sans lokálne, Tailwind s CSS layers, react-i18next (`sk`, `en`), TanStack Router a Query, axios inštancia, stránka 404 v štýle login screenu, `/` prázdna stránka.
4. **Orchestrátor:** `docker-compose.yml` (db, backend, frontend s healthcheckmi), Dockerfiles, nginx, Postgres init skript, `scripts/` pre oba režimy, `DATABASE_URL` override pre kontajner.
5. **Integrácia:** `check-scope.sh` pre obe vetvy, merge, `pnpm verify`, `pnpm stack:up`.

- **Overenie:**
  - `cp .env.example .env && docker compose up` → všetky healthchecky zelené
  - `curl http://localhost:8080/api/health` vráti stav DB
  - SQL kontrola admina v DB
  - neexistujúca FE route cez `:8080` zobrazí 404 v dizajne (Playwright screenshot), refresh na hlbokej route nevráti nginx 404
  - dev režim: `pnpm db:up && pnpm db:migrate && pnpm dev`, HMR na FE, reštart BE
  - integračné testy a unit testy (preklady `ErrorCode`/`ValidationCode`) prejdú

### A4. Review a súhrn

- Code Reviewer nad celým diffom míľnika, oprava `high` a `medium` nálezov.
- Doplnenie skills, ktoré už majú reálny obsah (`project-standards`, `commit-messages`, `local-env`, `database-migrations`, `docs-update`, časť `testing`, `frontend-conventions`, `backend-conventions`, `figma-to-code`).
- Kontrola `docs/` voči kódu, záznam v `docs/changelog.md`.
- Súhrn pre používateľa a zastavenie pred míľnikom B.
