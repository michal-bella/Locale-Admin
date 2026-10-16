---
title: 'Changelog'
updated: 2026-10-16
notion_page_id:
---

# Changelog

## Fáza 1

### Míľnik B: Prihlásenie (2026-10-16)

- zdieľaný kontrakt: `ROLE`, `loginRequestSchema`, `AuthUser`, `getInitials`
- backend: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, session v Postgrese (hash tokenu, sliding TTL 7 dní, absolútny limit 30 dní, posun cookie), globálna CSRF ochrana, rate limit loginu s `Retry-After`, `requireAuth` a `requireRole`, nové ENV (`COOKIE_SECURE`, `SESSION_*`, `LOGIN_RATE_LIMIT_*`), dev server počúva iba na `127.0.0.1` ([ADR 0004](./decisions/0004-db-session.md))
- frontend: prihlasovacia obrazovka podľa Figmy, horná lišta (logo, SK/EN, zvonček, menu používateľa), guardy rout, stránky 403 a všeobecnej chyby, placeholder `/admin/users` iba pre `ADMIN`
- E2E: Playwright balík (Chromium + WebKit, setup so `storageState` pre ADMIN a EDITOR), `pnpm test:e2e` reštartuje stack s vyšším rate limitom
- skills `api-smoke`, `backend-conventions`, `frontend-conventions`, `local-env` doplnené o auth, `testing` o E2E

### Míľnik A: Základ (2026-10-16)

- AI harness: hierarchia `AGENTS.md`, päť rolí agentov, workflow s worktree a kontrolou `check-scope.sh`, adaptéry pre Claude Code, Codex a Cursor, 10 skills
- monorepo (pnpm 12, Node 24), root ESLint a Prettier, TypeScript 6 strict, husky, lint-staged, commitlint, secretlint
- zdieľaný kontrakt `@locale/shared`: chybové a validačné kódy, schémy emailu, hesla a health
- backend: Express 5 cez `createApp`, validácia ENV, chybový kontrakt, Prisma 7 s modelmi `User` a `Session`, idempotentný seed admina, `GET /api/health` so stavom DB, integračné testy voči `locale_test`
- frontend: Vite+ SPA, Mantine theme podľa Figmy, DM Sans lokálne, Tailwind s CSS layers, i18n (sk, en), TanStack Router a Query, axios inštancia s CSRF hlavičkou, stránka 404
- Docker Compose (db, backend, frontend s healthcheckmi), nginx proxy a SPA fallback, skripty pre vývojový režim aj produkčný stack
