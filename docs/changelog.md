---
title: 'Changelog'
updated: 2026-10-18
notion_page_id:
---

# Changelog

## Po fáze 1

### Preklady a import: záverečné E2E, prístupnosť a dokumentácia (2026-10-19)

- E2E: `translations-flow.spec.ts` – celý tok import → pridanie chýbajúceho jazyka → preklad v riadku → filtre v URL → opakovaný import bez zmien; zdieľané pomocné funkcie stránky Preklady a modálu importu v `e2e/support/`
- prístupnosť stránky Preklady: stránkovanie nestráca fokus na krajných stranách (`aria-disabled`), oznámenie počtu výsledkov po vyhľadávaní a filtroch (živý región), chybový stav ako `role="alert"`, čas poslednej zmeny ako `<time>` s úplným dátumom, tmavší text odznakov stavu v svetlom režime; otvorené: žltá výplň progress baru Chýbajúce (netextový kontrast 1,7 : 1, rozhodnutie dizajnu)
- dokumentácia: prehľad, databáza, frontend, API a testovanie zosúladené s kódom, doménová tabuľka v `AGENTS.md` (limit kľúča v bajtoch, namespace, import), stav míľnikov v pláne

### Úprava prekladu v riadku (2026-10-19)

- zdieľaný kontrakt: `updateTranslationRequestSchema` (`{ value }`, max. 10 000 znakov, prázdny text = `null`), chybové kódy `PLACEHOLDER_MISMATCH` (400, `details { missing, extra }`) a `TRANSLATION_KEY_NOT_FOUND` (404)
- backend: `PUT /api/projects/:projectId/keys/:keyId/translations/:languageId` – upsert prekladu; pri zapnutom `protectVariables` porovná premenné `{{…}}` so základným jazykom (normalizácia zdieľaná s importom v `lib/placeholders.ts`) a nesúlad odmietne ([API](./api/translations.md))
- frontend: klik do bunky cieľového jazyka otvorí `Textarea`, uloží sa pri strate fokusu alebo Ctrl/Cmd+Enter, Esc zruší; optimistická aktualizácia hodnoty, stavu aj kariet s návratom pri chybe; nesúlad premenných sa zobrazí pod poľom a editor ostane otvorený ([Frontend](./frontend.md))
- E2E: `translation-edit.spec.ts`, API smoke `PUT` prekladu, axe s otvoreným editorom

### Import prekladov: modál (2026-10-19)

- frontend: tlačidlo Importovať na stránke Preklady otvára modál v dvoch krokoch – nahratie CSV (vlastná dropzone, kontrola prípony a veľkosti ešte pred odoslaním, checkbox Vytvoriť chýbajúce kľúče, zoznam chýb súboru s číslami riadkov) a kontrola (priradenie stĺpcov k jazykom projektu, Pridať jazyk priamo z riadku s automatickým opakovaním kontroly, Preskočiť, upozornenia na premenné, súhrn nových kľúčov a prekladov); po importe notifikácia so súhrnom a obnovenie zoznamu ([Frontend](./frontend.md))
- i18n: texty modálu a všetky kódy chýb a upozornení importu v sk, cs, en
- prístupnosť: fokus na nadpis kroku pri zmene kroku, pomenované tlačidlá po riadkoch, `aria-controls` pri rozbaľovaní upozornení, nové tokeny `--app-color-warning-bg/-text`
- E2E: `import.spec.ts` (vymyslené fixtures `e2e/fixtures/import-*.csv`), API smoke importu, axe oboch krokov modálu

### Import prekladov: zápis (2026-10-18)

- zdieľaný kontrakt: `KEY_TOO_LONG` počíta UTF-8 bajty (max. 2 000 B, 2 000 znakov v cyrilike sa nezmestilo do unikátneho indexu), namespace max. 100 znakov, chybový kód `IMPORT_COLUMNS_INVALID` (400)
- backend: `POST /api/projects/:projectId/imports` – priradenie stĺpcov k jazykom (alebo preskočenie), voliteľné vytvorenie chýbajúcich kľúčov, zápis v jednej transakcii s `pg_advisory_xact_lock` na projekt a dávkovým upsertom; `null` v súbore nikdy neprepíše vyplnený preklad, rovnaké hodnoty sa nemenia, opakovaný import = 0 zmien ([Import](./api/imports.md))
- výkon: 2 500 kľúčov × 10 jazykov (25 000 prekladov) za ~0,7 s

### Import prekladov: parser CSV a kontrola súboru (2026-10-18)

- zdieľaný kontrakt: `importPreviewRequestSchema`, `importPreviewResponseSchema`, `importRequestSchema` (pre ďalší krok), kódy `IMPORT_ISSUE_CODES`, chybové kódy `IMPORT_FILE_INVALID` (422, `details.issues`) a `IMPORT_FILE_TOO_LARGE` (413)
- backend: parser formátu GoodRequest i18nextJsonToCsv (`; `, sekcie `--namespace--`, `null` aj `""` = nepreložené) s chybami po riadkoch; `POST /api/projects/:projectId/imports/preview` spáruje stĺpce s jazykmi, porovná súbor s DB a vráti počty zmien a upozornenia, nič nezapisuje ([Import](./api/imports.md))
- limity: telo do 12 MB len na routách importu (inde 100 kB), obsah súboru do 10 MB, nginx `client_max_body_size 12m` pre `/api/`
- zistenie: 2 000-znakový kľúč v cyrilike sa do DB nezmestí (limit btree indexu), treba rozhodnúť pred zápisom importu

### Preklady: dátový model a zoznam na čítanie (2026-10-18)

- databáza: tabuľky `TranslationKey` (projekt, namespace, názov, unikátne v projekte + namespace) a `Translation` (kľúč + jazyk, `value` `null` = nepreložené), cascade z projektu, jazyka aj kľúča; seed pridá nový seedovaný projekt s ~30 vymyslenými kľúčmi v 2 namespace ([Databáza](./database.md))
- zdieľaný kontrakt: `translationsQuerySchema`, `translationsResponseSchema`, stavy `TRANSLATED` / `UNTRANSLATED` (odvodené, neukladajú sa)
- backend: `GET /api/projects/:projectId/translations` s vyhľadávaním (kľúč aj text), filtrom stavu a namespace, zoradením, stránkovaním a štatistikami pre cieľový jazyk ([API](./api/translations.md))
- frontend: stránka Preklady (`/projects/<slug>/translations`) ako prvá položka sidebaru a predvolená stránka projektu, karty štatistík, filtre v URL, zoskupenie podľa namespace a prefixu kľúča, nepreložené riadky s červeným pozadím; Importovať je zatiaľ neaktívne ([Frontend](./frontend.md))
- E2E: stránka Preklady, API smoke a axe kontrola v light aj dark režime

### Slug v URL projektu, čeština a akcie v tabuľkách (2026-10-18)

- frontend: projekt má v URL slug namiesto id (`/projects/<slug>/settings`), API ostáva na id; po zmene slugu v nastaveniach sa URL prepíše na nový ([Frontend](./frontend.md))
- frontend: čeština ako tretí jazyk rozhrania, prepínač jazyka v hornej lište je `Select` s vlajkami namiesto SK/EN prepínača
- frontend: zvonček notifikácií odstránený z hornej lišty, vráti sa s notifikáciami
- frontend: na stránkach Používatelia, Členovia a Jazyky sú akcie riadku explicitné ikony (kôš, odobratie člena) namiesto menu `⋯`

### Favicon a akcie v zozname projektov (2026-10-18)

- frontend: favicon s ružovým logom zo sidebaru; v zozname projektov namiesto menu `⋯` priamo ikony Nastavenia a Opustiť projekt ([Frontend](./frontend.md#zoznam-projektov))

### Jazyky na úrovni projektu (2026-10-18)

- databáza: tabuľka `ProjectLanguage` (tag a základný jazyk per projekt, čiastočný unikátny index na základný jazyk v projekte); migrácia `project_languages` skopírovala dovtedajšie globálne jazyky do každého projektu a zmazala tabuľku `Language` ([Databáza](./database.md))
- zdieľaný kontrakt: `languageTags` pri vytvorení projektu (aspoň jeden, prvý je základný), zrušená úprava názvov a vlajky jazyka
- backend: `GET`, `POST`, `DELETE /api/projects/:projectId/languages` pre členov aj ADMIN-a; `baseLanguageId` v nastaveniach projektu mení ktorýkoľvek člen; `/api/languages` a `/api/admin/languages` zrušené ([API](./api/project-languages.md))
- frontend: stránka Jazyky projektu (`/projects/$projectId/languages`, položka v sidebari projektu), výber jazykov v modáli Nový projekt, admin stránka `/languages` a modál Nastavenia jazyka zrušené
- E2E: jazyky v testovacích projektoch bez zdieľaného locku
- plán: [project-languages.md](./plans/project-languages.md)

### Odobratie člena a odstránenie admina (2026-10-18)

- backend: `DELETE /api/projects/:projectId/members/:userId` (člen aj ADMIN, účet ostane, posledného člena nejde odobrať) a `DELETE /api/admin/users/:id` (iba iného admina, nový kód `SELF_DELETE`)
- frontend: menu `⋯` s Odobrať z projektu na stránke Členovia a Odstrániť na stránke Používatelia, oboje s potvrdením; úprava člena nie je, meno sa mení v profile
- E2E: odobratie člena a odstránenie admina cez UI

### Projekty a členovia (MVP, 2026-10-18)

- organizácie vypadli: používateľ s rolou `EDITOR` (v UI „Člen“) spravuje svoje projekty sám, `ADMIN` vidí všetky
- zdieľaný kontrakt: `ProjectListItem`, `createProjectRequestSchema`, `ProjectMember`, `createProjectMemberRequestSchema`, `baseLanguageId` v nastaveniach projektu voliteľné, nové chybové kódy `SLUG_TAKEN` a `LAST_MEMBER`
- backend: `/api/projects` (zoznam, vytvorenie, opustenie, nastavenia, členovia) s prístupom pre člena alebo ADMIN-a (inak 404); `/api/admin/project` zrušené; `/api/admin/users` zobrazuje a vytvára iba adminov; zoznam jazykov presunutý na `GET /api/languages` pre každého prihláseného ([API](./api/projects.md))
- frontend: úvodná stránka so zoznamom projektov bez sidebaru (Nový projekt, Opustiť projekt, Nastavenia), routy `/projects/$projectId/settings` a `/members` so sidebarom, stránka Členovia, `/project-settings` zrušené
- E2E: testy projektov a členov, testovací používatelia sa zakladajú cez Členovia v testovacom projekte, `teardown` maže aj testovacie projekty
- plán: [projects.md](./plans/projects.md)

### Nastavenia projektu (MVP, 2026-10-17)

- zdieľaný kontrakt: `ProjectSettings`, `updateProjectSettingsRequestSchema` (názov, slug `a-z0-9` s pomlčkami, farba `#RRGGBB` uložená veľkými písmenami, ochrana premenných, základný jazyk)
- databáza: tabuľky `Project` a `ProjectMember`, seed jedného projektu `B2B Admin` / `b2b-admin` so seedovaným adminom ako členom iba do prázdnej tabuľky ([Databáza](./database.md))
- backend: `GET` a `PATCH /api/admin/project` iba pre ADMIN; zmena základného jazyka v tej istej transakcii cez spoločnú funkciu `setBaseLanguage` ([API](./api/projects.md))
- frontend: stránka `/project-settings` podľa Figmy doplnená o Základný jazyk a disabled tlačidlo Opustiť projekt, položka Nastavenia projektu v sekcii SPRÁVA sidebaru
- E2E: testy stránky (uloženie, základný jazyk, validácia, EDITOR 403, odhlásený), sidebar a axe s novou stránkou
- plán: [project-settings.md](./plans/project-settings.md)

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
