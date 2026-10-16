---
title: 'Fáza 1 – implementačný plán míľnika B'
updated: 2026-10-16
notion_page_id:
---

# Fáza 1 – implementačný plán míľnika B (Prihlásenie)

Rozpracovanie míľnika B z [phase-1.md](./phase-1.md). Postup podľa `.agents/workflows/feature.md`: kontrakt v `packages/shared` na `main`, potom FE a BE paralelne vo vlastných worktree, infra robí orchestrátor, E2E tester, review. Po každom kroku checkpoint (feedback loop, `docs/`, commit, krátky report).

## Overené verzie (2026-10-16)

Pravidlo ako v míľniku A: najnovšia stabilná verzia staršia ako 14 dní (`minimumReleaseAge`), presná verzia bez `^`. Overené cez npm registry a Context7.

| Balík | Verzia | Kde | Poznámka |
| --- | --- | --- | --- |
| `express-rate-limit` | 8.7.0 | backend | `limit`, `windowMs`, `standardHeaders: 'draft-8'`, vlastný `handler` → `AppError` 429. 8.7.1 je mladšia ako 14 dní |
| `cookie-parser` / `@types/cookie-parser` | 1.4.7 / 1.4.10 | backend | čítanie session cookie |
| `react-hook-form` | 7.89.0 | frontend | 7.90.0 je mladšia ako 14 dní |
| `@hookform/resolvers` | 5.9.1 | frontend | `zodResolver` pre zod 4 |
| `@playwright/test` | 1.63.0 | e2e | Chromium + WebKit |
| `argon2`, `pg` | 0.45.1, 8.23.1 | e2e (dev) | rovnaké verzie ako backend, iba na založenie testovacieho EDITORa (viď rozhodnutia) |

## Rozhodnutia pre míľnik B

- **Session cookie:** názov `locale_session`, `httpOnly`, `SameSite=Lax`, `Path=/`, `Secure` podľa `COOKIE_SECURE`. Token 32 náhodných bajtov (base64url), v DB iba SHA-256 hash. ADR `0004` (DB session vs JWT).
- **Sliding TTL:** `expiresAt = min(now + SESSION_TTL_DAYS, createdAt + SESSION_MAX_AGE_DAYS)`. DB zápis (a nový `Set-Cookie` s `Max-Age` = zostatok) iba ak od `lastUsedAt` prešlo aspoň 5 minút (konštanta `SESSION_TOUCH_INTERVAL_MS` v backende, nie ENV — plán ju nedáva do ENV).
- **Login odpoveď:** `200` s rovnakým telom ako `GET /api/auth/me` (`AuthUser`), aby FE nemusel robiť ďalšiu požiadavku. Logout `204` (idempotentný: bez session tiež `204` a zmaže cookie).
- **Login schéma:** `email` cez `emailSchema`, `password` iba povinné (`min(1)`, `max(PASSWORD_MAX_LENGTH)`), nie pravidlá nového hesla — staré heslá by inak nešlo zadať a zlé heslo musí vrátiť 401, nie 400.
- **Poradie middleware:** helmet → pino-http → `cookie-parser` → **CSRF** (globálne pre `POST/PUT/PATCH/DELETE`, `req.is('application/json')` + `X-Requested-With: XMLHttpRequest`) → `express.json()` → routy. Rate limit iba na `POST /api/auth/login`, počíta každý pokus (aj úspešný), kľúč IP (`trust proxy 1`).
- **Auth middleware:** `requireAuth` (načíta session, sliding, nastaví `req.auth = { user, session }`, inak 401 `AUTH_UNAUTHENTICATED` a zmaže cookie aj expirovaný riadok) a `requireRole(ROLE.ADMIN)` (403 `FORBIDDEN`). Neaktívny user so session → 401 (session sa zmaže).
- **403 na BE v míľniku B:** v produkcii zatiaľ nie je žiadna ADMIN-only routa (`/api/admin/users` je míľnik C). `requireRole` sa overí **integračným testom**, ktorý si v teste postaví malú Express app z reálnych middleware (`requireAuth` + `requireRole`) a reálnej DB. Žiadna testovacia routa v produkčnom kóde. End-to-end 403 pre EDITORa na `/api/admin/users` príde v C.
- **FE 403 v míľniku B:** route `/admin/users` existuje ako placeholder (nadpis „Používatelia“, obsah príde v C). `beforeLoad` pre non-ADMIN zobrazí stránku 403 (v štýle login screenu ako 404). Overí to Playwright s EDITORom.
- **EDITOR pre E2E:** vytváranie používateľov cez API je až v C. E2E setup preto EDITORa založí priamo v lokálnej DB (`pg` + `argon2`, `DATABASE_URL` z `.env`, unikátny email s timestampom). V C sa prepne na `POST /api/admin/users`.
- **Ochrana rout na FE:** layout route `_authenticated` s `beforeLoad` → `queryClient.ensureQueryData(meQuery)`; pri 401 `redirect({ to: '/login' })` bez `?redirect=`. Route `/login` pri úspešnom `me` presmeruje na `/`. 401 počas behu (vypršaná session) → axios response interceptor vyčistí `me` cache a router naviguje na `/login` (okrem požiadavky samotného loginu).
- **Logout na FE:** `POST /api/auth/logout` bez tela (axios interceptor pošle `{}`), potom `queryClient.clear()` a navigácia na `/login`.
- **Horná lišta:** nový dizajn zložený z prvkov Figmy `28-2` (logo, zvonček, avatar, výška a okraj lišty). Iniciály cez `getInitials()` v `packages/shared` (budú ich používať aj tabuľka v C).
- **`pnpm test:e2e`:** `scripts/test-e2e.sh` vždy spustí `LOGIN_RATE_LIMIT_MAX=1000 docker compose up -d --build --wait --force-recreate backend frontend`, potom Playwright. Po E2E ostane stack bežať s limitom 1000; `pnpm stack:up` ho vráti na hodnoty z `.env` (compose zmenu ENV pozná a kontajner znova vytvorí).

## Kroky

### B1. Kontrakt (orchestrátor, `main`)

- `packages/shared/src/auth.ts`: `ROLE` enum (`ADMIN`, `EDITOR`), `loginRequestSchema` + `LoginRequest`, `authUserSchema` + `AuthUser` (`{ id, email, role, firstName, lastName }`), `getInitials(user)`.
- Unit testy pre schému loginu a `getInitials`.
- **Overenie:** `pnpm --filter @locale/shared test`, `pnpm lint`, `pnpm typecheck`.

### B2. Infra (orchestrátor, `main`, pred worktree)

- `.env.example` a `docker-compose.yml`: `COOKIE_SECURE=false`, `SESSION_TTL_DAYS=7`, `SESSION_MAX_AGE_DAYS=30`, `LOGIN_RATE_LIMIT_MAX=10`, `LOGIN_RATE_LIMIT_WINDOW_MS=900000`.
- `scripts/test-e2e.sh` podľa rozhodnutia vyššie, kostra `e2e/package.json` so skriptom `test:e2e` (obsah dopĺňa E2E tester).
- **Overenie:** `docker compose config` je platný, `pnpm lint`.

### B3. Backend (Backend Developer, worktree `agent/be-auth`)

- ENV (`envSchema`, `Config`, `TEST_CONFIG`), `cookie-parser`, CSRF middleware, rate limit, session service, `requireAuth`, `requireRole`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `lastLoginAt`, upratanie expirovaných session pri logine.
- Integračné testy: login (OK, case-insensitive email, `lastLoginAt`, zlé heslo, neaktívny user, neexistujúci email, validácia 400), me (401 bez cookie, 401 po logoute s tou istou cookie, 401 po TTL s posunutým `expiresAt` a zmazaný riadok, absolútny limit), sliding (posunuté `lastUsedAt` → nový `Set-Cookie` s `Max-Age`, do 5 min žiadny zápis), CSRF (bez `X-Requested-With`, `application/x-www-form-urlencoded`, logout s `{}`), rate limit (`max=3`, 4. pokus 429 s `Retry-After`), `requireRole` 403, cookie atribúty podľa `COOKIE_SECURE`.
- `docs/api/auth.md`, `docs/api/README.md`, `docs/database.md` (session), helper `loginAs(user)` v `backend/test/helpers/`.
- **Overenie:** `pnpm --filter backend lint|typecheck|test|test:integration`, `check-scope.sh backend-developer`.

### B4. Frontend (Frontend Developer, worktree `agent/fe-auth`, paralelne s B3)

- Login screen podľa Figmy `5:2861` (React Hook Form + `zodResolver(loginRequestSchema)`, chyby podľa `errors.<CODE>`, 429 so sekundami z `Retry-After`, loading stav).
- API hooky (`useMeQuery`/`meQueryOptions`, `useLoginMutation`, `useLogoutMutation`), `QUERY_KEYS.AUTH.ME`, 401 interceptor.
- Routy: `/login`, layout `_authenticated` (horná lišta) s `/` a `/admin/users` (placeholder, iba ADMIN), stránka 403, guardy.
- Horná lišta: logo, prepínač SK/EN (`localStorage`), statický zvonček, menu používateľa (iniciály + email, Používatelia iba ADMIN, Odhlásiť). Ikony z Figmy cez SVGR.
- Unit testy (login formulár, guardy, menu podľa roly, prepínač jazyka), `docs/frontend.md`.
- **Overenie:** `pnpm --filter frontend lint|typecheck|test`, `check-scope.sh frontend-developer`.

### B5. Integrácia (orchestrátor)

- `check-scope.sh` pre obe vetvy, `git merge --no-ff --no-edit`, `pnpm install`, `pnpm verify`, `pnpm stack:up`, `api-smoke`.

### B6. E2E (E2E Tester, worktree `agent/e2e-auth`)

- Playwright balík: `playwright.config.ts` (Chromium + WebKit, `baseURL` z `E2E_BASE_URL`, setup projekt so `storageState` pre ADMIN a EDITOR).
- Testy: login/logout (aj WebKit), session prežije refresh, logout → `/login` a stará cookie dostane 401, zlé heslo zobrazí preklad, case-insensitive email, neprihlásený na `/` → `/login`, prihlásený na `/login` → `/`, ADMIN vidí Používatelia a EDITOR nie, EDITOR na `/admin/users` → 403, neexistujúca route → 404, SK/EN bez reloadu a po refreshi, žiadne požiadavky na Google Fonts, refresh na `/admin/users` nevráti nginx 404.
- **Overenie:** `pnpm test:e2e` pri už bežiacom `pnpm stack:up` bez 429, `check-scope.sh e2e-tester`.

### B7. Review a súhrn

- Code Reviewer nad diffom míľnika, opravy `high` a `medium` cez vlastnícku rolu.
- Skills: `api-smoke` (login, me, logout, 401, 403 CSRF, 429), `testing` (E2E), `backend-conventions` (auth middleware), `frontend-conventions` (guardy), `local-env` (cookie a `COOKIE_SECURE`).
- `docs/`: ADR `0004`, `docs/architecture.md` (auth flow), `docs/local-development.md` (nové ENV), `docs/testing.md`, `docs/changelog.md`.
- Overenie v reálnom stacku na `http://localhost:8080` (login admina, screenshot loginu vs Figma `5:2861`).
- Súhrn pre používateľa, zastavenie pred míľnikom C.

## Akceptačné kritériá míľnika B

Z [phase-1.md](./phase-1.md#akceptačné-kritériá-definition-of-done), ktoré sa týkajú prihlásenia:

- sliding session posúva aj cookie (integračný test)
- logout cez FE (axios, bez tela) prejde CSRF kontrolou
- login a logout fungujú v Playwright WebKit voči `http://localhost:8080`
- `pnpm test:e2e` pri bežiacom `pnpm stack:up` neskončí 429
- aplikácia funguje celá cez `:8080`, refresh na `/admin/users` nevráti nginx 404
- admin sa prihlási emailom `michal.bella@goodrequest.com` a heslom z `.env`, aj s inou veľkosťou písmen; `lastLoginAt` sa nastaví
- zlé heslo → 401 `AUTH_INVALID_CREDENTIALS`, FE zobrazí preklad
- 429 `RATE_LIMITED` overený integračným testom
- neprihlásený na chránenej route → `/login`; neexistujúca route → 404
- po prihlásení ADMIN aj EDITOR na `/`, Používatelia v menu iba pre ADMIN
- prepínač SK/EN bez reloadu, voľba prežije refresh
- DM Sans lokálne (žiadne Google Fonts)
- session prežije refresh, logout zmaže riadok a stará cookie dostane 401
- session po TTL vráti 401 (integračný test)
- mutácia bez `X-Requested-With` alebo s iným `Content-Type` → 403 `CSRF_REJECTED` (integračný test aj `api-smoke`)
- `pnpm verify` a Playwright prejdú, Code Reviewer bez otvorených `high`, `check-scope.sh` prejde pre každú rolu
- **čiastočne:** `EDITOR` na `/admin/users` dostane 403 — v B na FE (E2E) a BE `requireRole` integračným testom; BE endpoint `/api/admin/users` v C
