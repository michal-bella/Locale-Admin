---
title: 'Fáza 1 – implementačný plán míľnika C'
updated: 2026-10-16
notion_page_id:
---

# Fáza 1 – implementačný plán míľnika C (Používatelia)

Rozpracovanie míľnika C z [phase-1.md](./phase-1.md). Postup podľa `.agents/workflows/feature.md`: kontrakt v `packages/shared` na `main`, potom FE a BE paralelne vo vlastných worktree, E2E tester, review. Po každom kroku checkpoint (feedback loop, `docs/`, commit, krátky report). Míľnik C je posledný, končí krokom 6 plánu (skills, kontrola `docs/`, finálny Code Review) a kontrolou všetkých akceptačných kritérií Fázy 1.

## Overené verzie (2026-10-16)

Míľnik C **nepridáva žiadnu novú závislosť**. Všetko potrebné už je v repe v overených verziách z A a B: Mantine 9.6.3 (`Table`, `Modal`, `Skeleton`, `Avatar`, `@mantine/notifications`), `react-hook-form` 7.89.0 + `@hookform/resolvers` 5.9.1, TanStack Router 1.170.41 (`createLazyRoute` + `Route.lazy()` pre code-based routing, overené v Context7), TanStack Query 5.104.0, zod 4.6.5 (`z.iso.datetime()`). Z `e2e` sa odoberie `argon2` (EDITOR sa už nezakladá priamo v DB).

## Rozhodnutia pre míľnik C

- **Kontrakt** (`packages/shared/src/adminUsers.ts`):
  - `createUserRequestSchema = { email: emailSchema, password: passwordSchema }` → `CreateUserRequest`. Rovnaká schéma pre FE formulár aj BE validáciu, email sa normalizuje (trim + malé písmená).
  - `adminUserSchema = { id, email, role, createdAt }` → `AdminUser`, `createdAt` ako ISO reťazec (`z.iso.datetime()`). Presne polia z plánu, nikdy `passwordHash`. Iniciály v tabuľke preto z emailu (`getInitials` s `firstName`/`lastName` = `null`); meno pribudne s obrazovkou Profil.
  - `adminUserListResponseSchema = { users: AdminUser[] }` (obálka nechá miesto na stránkovanie v ďalších fázach bez zmeny tvaru).
- **API:** `GET /api/admin/users` → `200 { users }` zoradené `createdAt desc`. `POST /api/admin/users` → `201 AdminUser`, rola vždy `EDITOR` (pole `role` v tele sa ignoruje, schéma ho nemá). Obe routy za `createRequireAuth(prisma, config)` + `requireRole(ROLE.ADMIN)` na úrovni routera `/api/admin`. Duplicitný email → `409 EMAIL_TAKEN`; súbeh rieši zachytenie Prisma `P2002` (unique constraint), nie iba predbežná kontrola. Heslo argon2id rovnako ako seed, `passwordChangedAt = now`.
- **FE:** stránka podľa Figmy `28:2` v existujúcom layoute (eyebrow „Správa“, nadpis, podnadpis, tlačidlo s ikonou `+` z Figmy cez SVGR), tabuľka v karte (avatar z iniciál, dátum cez `Intl.DateTimeFormat` podľa jazyka `sk-SK` / `en-GB`), stavy loading (Mantine `Skeleton`), prázdny zoznam, chyba s tlačidlom „Skúsiť znova“. Modál podľa `28:191`, `useCreateUserMutation`: `400` → `setError` podľa `details`, `409` → chyba pri poli E-mail, iná chyba → všeobecná notifikácia; po úspechu zatvoriť, resetovať, `invalidateQueries(QUERY_KEYS.ADMIN.USERS)` a notifikácia.
- **Code splitting (odložený low nález z B):** komponenty stránok cez `createLazyRoute` + `.lazy()`, guardy (`beforeLoad`) ostávajú v hlavnom chunku. Cieľ: hlavný chunk pod hranicou varovania Vite (500 kB). Ak by to nestačilo, ďalší postup sa iba zapíše, neblokuje.
- **E2E:** EDITOR v setup projekte vzniká cez `POST /api/admin/users` (Playwright `request` s admin `storageState`), email ostáva s prefixom `e2e-editor-` a teardown ho zmaže priamo v DB (`DELETE` endpoint vo Fáze 1 nie je). Rovnaký prefix majú aj používatelia vytvorení v UI testoch. Guard: `DATABASE_URL` pre E2E musí ukazovať na `localhost`/`127.0.0.1`/`::1`, inak test skončí chybou.
- **Vizuálne porovnanie** s Figmou robí orchestrátor jednorazovo (Playwright screenshot vs `get_screenshot` `28:2` a `28:191`), rozdiely idú používateľovi na potvrdenie.

## Kroky

### C1. Kontrakt (orchestrátor, `main`)

- `adminUsers.ts` podľa rozhodnutí, export z `index.ts`, unit testy (normalizácia emailu, heslo kratšie ako 8 → `TOO_SHORT` s `min`, chýbajúce polia → `REQUIRED`, `adminUserSchema` neprepustí `passwordHash`).
- **Overenie:** `pnpm --filter @locale/shared test`, `pnpm lint`, `pnpm typecheck`.

### C2. Backend (Backend Developer, worktree `agent/be-users`)

- `routes/adminUsers.routes.ts`, `controllers/adminUsers.controller.ts`, `services/adminUsers.service.ts`, router `/api/admin` s `requireAuth` + `requireRole(ADMIN)`.
- Integračné testy: zoznam (ADMIN 200, poradie od najnovšieho, bez `passwordHash`), vytvorenie (201, rola `EDITOR` aj keď telo pošle `ADMIN`, normalizovaný email, nový user sa vie prihlásiť), 400 s `details` (zlý email, krátke heslo s `params.min`, chýbajúce polia), 409 aj pre inú veľkosť písmen, 401 bez session pre GET aj POST, 403 pre EDITORa pre GET aj POST, CSRF na POST.
- `docs/api/admin-users.md`, `docs/api/README.md`.
- **Overenie:** `pnpm --filter backend lint|typecheck|test|test:integration`, `check-scope.sh backend-developer`.

### C3. Frontend (Frontend Developer, worktree `agent/fe-users`, paralelne s C2)

- `api/adminUsers/` (`adminUsersQuery`, `useCreateUserMutation`), `QUERY_KEYS.ADMIN.USERS`.
- `UsersPage` (hlavička, tabuľka, stavy), `CreateUserModal`, ikona `+` z Figmy, formátovanie dátumu v `lib/`, preklady `sk` aj `en`.
- Code splitting stránok podľa rozhodnutia.
- Unit testy: tabuľka a stavy, dátum v SK aj EN, modál (validácia, 400 a 409 pri poli, úspech zatvorí a invaliduje).
- `docs/frontend.md`.
- **Overenie:** `pnpm --filter frontend lint|typecheck|test`, build bez varovania o veľkosti chunku, `check-scope.sh frontend-developer`.

### C4. Integrácia (orchestrátor)

- `check-scope.sh` pre obe vetvy, `git merge --no-ff --no-edit`, `pnpm install`, `pnpm verify`, `pnpm stack:up`, `api-smoke` (`/api/admin/users`: 401, 403, 400, 409, 201).

### C5. E2E (E2E Tester, worktree `agent/e2e-users`)

- Setup EDITORa cez API, odobratie `argon2`, guard na lokálnu DB, upratanie JSDoc a prefixu v `support/db.ts`.
- Testy: vytvorenie v modáli → riadok v tabuľke bez refreshu → nový user sa prihlási, nevalidný email a krátke heslo pri poli, 409 aj s inou veľkosťou písmen pri poli E-mail, EDITOR: `GET`/`POST /api/admin/users` → 403 a stránka 403, neprihlásený `/api/admin/users` → 401, dátum podľa jazyka (SK aj EN).
- **Overenie:** `pnpm test:e2e` (Chromium + WebKit), `check-scope.sh e2e-tester`.

### C6. Review a vizuálne porovnanie

- Code Reviewer nad diffom míľnika, opravy `high` a `medium` cez vlastnícku rolu.
- Screenshoty stránky a modálu vs Figma `28:2` a `28:191`, zoznam rozdielov.

### C7. Krok 6 plánu (orchestrátor)

- Nové skills `add-endpoint` a `add-page` podľa toho, ako sa robil C, doplnenie existujúcich skills (`api-smoke`, `testing`, `frontend-conventions`, `backend-conventions`), tabuľka skills v `AGENTS.md`.
- Kontrola všetkých stránok `docs/` voči kódu, `docs/changelog.md`.
- Finálny Code Reviewer nad celou Fázou 1, opravy.
- Prejdenie všetkých akceptačných kritérií Fázy 1 s dôkazom, súhrn pre používateľa.

## Akceptačné kritériá míľnika C

Všetky kritériá Fázy 1 z [phase-1.md](./phase-1.md#akceptačné-kritériá-definition-of-done), pre C hlavne:

- admin vidí zoznam (E-mail, Vytvorený), cez modál vytvorí používateľa, ten sa objaví bez refreshu a vie sa prihlásiť
- nevalidný email, heslo kratšie ako 8 znakov (400) a existujúci email aj s inou veľkosťou písmen (409) zobrazia chybu pri poli
- dátum v tabuľke podľa zvoleného jazyka (SK aj EN)
- `EDITOR` na `/admin/users` dostane 403 (BE aj FE)
- obsah stránky a modál vizuálne zodpovedajú Figme (manuálne porovnanie, potvrdzuje používateľ)
- `docs/` popisuje skutočný stav kódu, Code Reviewer bez otvorených `high`
