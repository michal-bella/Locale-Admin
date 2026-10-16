---
title: 'Changelog'
updated: 2026-10-16
notion_page_id:
---

# Changelog

## Fáza 1

### Míľnik A: Základ (2026-10-16)

- AI harness: hierarchia `AGENTS.md`, päť rolí agentov, workflow s worktree a kontrolou `check-scope.sh`, adaptéry pre Claude Code, Codex a Cursor, 10 skills
- monorepo (pnpm 12, Node 24), root ESLint a Prettier, TypeScript 6 strict, husky, lint-staged, commitlint, secretlint
- zdieľaný kontrakt `@locale/shared`: chybové a validačné kódy, schémy emailu, hesla a health
- backend: Express 5 cez `createApp`, validácia ENV, chybový kontrakt, Prisma 7 s modelmi `User` a `Session`, idempotentný seed admina, `GET /api/health` so stavom DB, integračné testy voči `locale_test`
- frontend: Vite+ SPA, Mantine theme podľa Figmy, DM Sans lokálne, Tailwind s CSS layers, i18n (sk, en), TanStack Router a Query, axios inštancia s CSRF hlavičkou, stránka 404
- Docker Compose (db, backend, frontend s healthcheckmi), nginx proxy a SPA fallback, skripty pre vývojový režim aj produkčný stack
