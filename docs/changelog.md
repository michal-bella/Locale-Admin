---
title: 'Changelog'
updated: 2026-10-17
notion_page_id:
---

# Changelog

## Po fáze 1

### Jazyky (MVP, 2026-10-17)

- zdieľaný kontrakt: katalóg 9 podporovaných jazykov (`SUPPORTED_LANGUAGES`: bg, cs, de-AT, en, hr, hu, ro, ru, sk), `Language`, `createLanguageRequestSchema`, `updateLanguageRequestSchema`, nové chybové kódy `LANGUAGE_TAKEN` a `LANGUAGE_IS_BASE`
- databáza: tabuľka `Language` s čiastočným unikátnym indexom (najviac jeden základný jazyk), seed `sk` (základný) a `en` iba do prázdnej tabuľky ([Databáza](./database.md))
- backend: `GET`, `POST`, `PATCH`, `DELETE /api/admin/languages` iba pre ADMIN; prvý jazyk je základný, zmena základného jazyka v jednej transakcii, základný jazyk sa nedá odstrániť ([API](./api/admin-languages.md))
- frontend: stránka `/languages` podľa Figmy (bez stĺpcov štatistík prekladov), modaly Pridať jazyk, Nastavenia jazyka a potvrdenie odstránenia, kruhové vlajky z [circle-flags](https://github.com/HatScripts/circle-flags) (MIT)
- frontend: sidebar podľa Figmy (logo, Jazyky a Používatelia pre ADMIN, dole meno, rola a menu Môj profil / Odhlásiť sa), na úzkych obrazovkách cez burger; horná lišta už iba SK/EN, téma a zvonček
- E2E: testy stránky Jazyky (pridanie, úprava, základný jazyk, odstránenie s potvrdením, EDITOR 403, odhlásený) a API smoke pre `/api/admin/languages`
- plán: [languages.md](./plans/languages.md)

### Môj profil (MVP, 2026-10-17)

- zdieľaný kontrakt: `updateProfileRequestSchema` (meno a priezvisko povinné, max. 100 znakov, orezané), `Profile` s `passwordChangedAt`
- backend: `GET /api/profile` a `PATCH /api/profile` pre ADMIN aj EDITOR, mení iba meno a priezvisko prihláseného používateľa ([API](./api/profile.md))
- frontend: stránka `/profile` podľa Figmy, položka Môj profil v menu používateľa, úprava mena a priezviska (iniciály v hornej lište sa zmenia hneď), funkčný výber jazyka rozhrania; email, pracovná pozícia, fotografia, notifikácie a zmena hesla sú zatiaľ disabled
- E2E: testy stránky profilu (uloženie, validácia, disabled prvky, jazyk, obe role, 401) a API smoke pre `/api/profile`
- plán: [profile.md](./plans/profile.md)

## Fáza 1

Uzavretá 2026-10-16: všetky akceptačné kritériá splnené, vizuálnu zhodu stránky Používatelia a modálu s Figmou potvrdil Michal Bella.

### Míľnik C: Používatelia (2026-10-16)

- zdieľaný kontrakt: `createUserRequestSchema`, `AdminUser`, `adminUserListResponseSchema`
- backend: `GET /api/admin/users` (od najnovšieho, bez `passwordHash`) a `POST /api/admin/users` (vždy `EDITOR`, 409 `EMAIL_TAKEN` aj pri inej veľkosti písmen a súbehu), router `/api/admin` iba pre `ADMIN` ([API](./api/admin-users.md))
- frontend: stránka Používatelia podľa Figmy (tabuľka s iniciálami, dátum podľa jazyka, stavy loading/prázdny/chyba), modál Nový používateľ (chyby 400 a 409 pri poli, nedá sa odoslať dvakrát ani zavrieť počas odosielania), lazy načítanie stránok a vendor chunky (hlavný chunk 71 kB namiesto 763 kB), biely modál v theme
- E2E: testovací EDITOR vzniká cez `POST /api/admin/users`, poistka na lokálnu DB, nové testy stránky Používatelia a API (401, 403, 400, 409, CSRF)
- harness: nové skills `add-endpoint` a `add-page`, `api-smoke` a `testing` doplnené o správu používateľov

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
