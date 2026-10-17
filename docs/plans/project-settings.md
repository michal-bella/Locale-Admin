---
title: 'Nastavenia projektu – implementačný plán (MVP)'
updated: 2026-10-17
notion_page_id:
---

# Nastavenia projektu – implementačný plán (MVP)

Obrazovka **Nastavenia projektu** podľa Figmy ([node `3-1557`](https://www.figma.com/design/8mjlOXj1MXEqGwkWlf83mZ/Admin-system-for-translations?node-id=3-1557&m=dev)), doplnená podľa screenshotu z iného systému o **Základný jazyk** a tlačidlo **Opustiť projekt**. Stránku vidí a mení iba ADMIN. Postup podľa `.agents/workflows/feature.md` rovnako ako Jazyky: kontrakt na vetve `feature/project-settings` (z `feature/languages`, lebo základný jazyk stavia na jazykoch), potom BE a FE paralelne vo vlastných worktree, E2E, review. Po každom kroku checkpoint (feedback loop, `docs/`, commit, krátky report).

## Predpoklady

- **Projekt zavádzame teraz, ale iba jeden.** Pribudne model `Project` a členstvo `ProjectMember`. Seed vytvorí jeden projekt, API pracuje s týmto jediným projektom (singleton). Organizácie, zoznam projektov, prepínač projektu a projektové role nie sú v rozsahu. Keď prídu, route sa presunie na `/projects/$projectId/settings` a API na `/api/admin/projects/:id`.
- **Základný jazyk ostáva globálny** (`Language.isBase` zo stránky Jazyky). Select v nastaveniach vyberá z existujúcich jazykov a uloženie presunie príznak `isBase`. Projekt nemá vlastné `baseLanguageId`. Keď sa jazyky naviažu na projekt, príznak sa presunie na väzbu projekt ↔ jazyk (mimo tohto plánu).
- **Opustiť projekt** je zatiaľ iba **disabled tlačidlo** s tooltipom. Logika (odchod z `ProjectMember`, ochrana posledného administrátora) príde s obrazovkou Členovia. `ProjectMember` sa teraz iba vytvorí a naplní seedom, aby na ňom Členovia a Opustiť projekt mohli stavať.
- **Primárna farba** a **Chrániť výrazy** sa iba ukladajú. Farba zatiaľ nemení tému aplikácie a ochrana premenných nemá účinok, kým neexistuje editor prekladov.

## Rozsah

| Prvok                                                                                       | MVP                                                                                         |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Hlavička stránky (eyebrow „Konfigurácia“, nadpis „Nastavenia projektu“, podnadpis)          | áno, cez `PageIntro`                                                                        |
| Sekcia **Základné údaje**: Názov projektu, Slug projektu (s nápovedou), Primárna farba      | áno                                                                                         |
| Tlačidlo/štítok **Ukážka** vedľa farby                                                      | áno, iba náhľad (štítok vo zvolenej farbe), nie akcia                                       |
| Pole **Základný jazyk** (zo screenshotu)                                                    | áno, v sekcii Základné údaje pod Primárnou farbou, `Select` s vlajkou                       |
| Sekcia **Ochrana dynamických segmentov** s prepínačom **Chrániť výrazy `{{ variable }}`**   | áno, ukladá sa `protectVariables`                                                           |
| Tlačidlo **Uložiť zmeny**                                                                   | áno, jedno uloženie celého formulára                                                        |
| Tlačidlo **Opustiť projekt** (zo screenshotu)                                               | áno, **disabled** s tooltipom „Bude dostupné spolu so správou členov“                       |
| Popis (markdown), avatar projektu, záložka Advanced zo screenshotu                          | **nie**                                                                                     |
| Sidebar (navigácia, prepínač projektu, box Chránené premenné), drobčeky, ikony `?` a zvonček | **nie** (layout Fázy 1 bez sidebaru)                                                        |

## Rozhodnutia

- **Route:** `/project-settings`, pod `authenticatedRoute` s `requireRole(ROLE.ADMIN)`. Lazy stránka podľa skillu `add-page`.
- **Vstup:** nová položka **Nastavenia projektu** v `UserMenu` pod položkou Jazyky, iba pre ADMIN.
- **Dátový model** (`backend/prisma/schema.prisma`, migrácia `add_project`):

  ```prisma
  model Project {
    id               String          @id @default(uuid()) @db.Uuid
    name             String
    slug             String          @unique
    primaryColor     String          @default("#E83E8C")
    protectVariables Boolean         @default(true)
    createdAt        DateTime        @default(now())
    updatedAt        DateTime        @updatedAt
    members          ProjectMember[]
  }

  model ProjectMember {
    projectId String   @db.Uuid
    project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
    userId    String   @db.Uuid
    user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
    createdAt DateTime @default(now())

    @@id([projectId, userId])
    @@index([userId])
  }
  ```

  `User` dostane spätnú reláciu `projectMemberships ProjectMember[]`.

- **Seed:** iba keď je tabuľka `Project` prázdna, vytvorí projekt `B2B Admin` / `b2b-admin` a pridá seedovaného ADMIN používateľa ako člena (rovnaký princíp ako pri jazykoch, aby sa zmeny admina po reštarte neprepisovali).
- **Kontrakt** (`packages/shared/src/projectSettings.ts`):
  - `PROJECT_NAME_MAX_LENGTH = 100`, `PROJECT_SLUG_MAX_LENGTH = 50`.
  - `projectNameSchema = z.string().trim().min(1).max(PROJECT_NAME_MAX_LENGTH)`.
  - `projectSlugSchema`: trim, `min(1)`, `max(PROJECT_SLUG_MAX_LENGTH)`, regex `^[a-z0-9]+(?:-[a-z0-9]+)*$` → `INVALID`.
  - `hexColorSchema`: regex `^#[0-9a-fA-F]{6}$`, transform na veľké písmená (`#E83E8C`).
  - `projectSettingsSchema = { id, name, slug, primaryColor, protectVariables, baseLanguageId: uuid | null }` → `ProjectSettings`. `baseLanguageId` je `id` jazyka s `isBase = true`, `null` keď nie je žiadny jazyk.
  - `updateProjectSettingsRequestSchema = { name, slug, primaryColor, protectVariables: z.boolean(), baseLanguageId: z.uuid() }`.
  - Žiadny nový `ERROR_CODE`. Neexistujúci `baseLanguageId` → `400 VALIDATION_ERROR` s `details.baseLanguageId = INVALID`. Chýbajúci projekt (nespustený seed) → existujúci `NOT_FOUND`.
- **API** (router `/api/admin/project` pod existujúcim `createAdminRouter`, auth aj `requireRole(ADMIN)` sú vyriešené):
  - `GET /api/admin/project` → `200 ProjectSettings`. `404 NOT_FOUND`.
  - `PATCH /api/admin/project` → `200 ProjectSettings`. `400 VALIDATION_ERROR`, `404 NOT_FOUND`.
  - V jednej transakcii uloží projekt a pri zmene `baseLanguageId` presunie `isBase`. Presun príznaku sa vytiahne zo `updateLanguage` do zdieľanej funkcie `setBaseLanguage(tx, languageId)` v `adminLanguages.service.ts`, ktorú používajú obe služby (čiastočný unikátny index na `isBase` ostáva poistkou).
  - `401`, `403 FORBIDDEN` (EDITOR), `403 CSRF_REJECTED` rieši existujúci middleware.
- **FE:**
  - `api/projectSettings/` (`projectSettingsQuery`, `useUpdateProjectSettingsMutation`), `QUERY_KEYS.PROJECT_SETTINGS()`. Po úspešnom uložení `invalidateQueries` pre `PROJECT_SETTINGS` aj `LANGUAGES` (zmena základného jazyka mení stránku Jazyky), zelená notifikácia.
  - `ProjectSettingsPage` (načíta nastavenia aj `languagesQuery`), `ProjectSettingsForm`, sekcie `ProjectBasicsSection` a `VariableProtectionSection`, riadok formulára „label vľavo (180 px), pole vpravo“ podľa Figmy.
  - **Primárna farba:** Mantine `ColorInput` (štvorček farby ako `leftSection`, hex vstup, picker v dropdown) a vedľa štítok **Ukážka** s pozadím vo zvolenej farbe. Figma má štvorček a hex vstup ako dva prvky; `ColorInput` ich spája do jedného, odchýlku potvrdí používateľ pri vizuálnom porovnaní.
  - **Základný jazyk:** `Select` s položkami z `languagesQuery` (`LanguageFlag` + anglický názov + tag), predvyplnený `baseLanguageId`. Pri prázdnom zozname jazykov disabled s nápovedou a odkazom na `/languages`.
  - **Chrániť výrazy:** Mantine `Switch` s popisom. Text `{{ variable }}` sa v i18next interpoluje, preto ide cez parameter (`t('…', { example: '{{ variable }}', interpolation: { escapeValue: false } })`), nie priamo v `sk.json`.
  - **Formulár:** React Hook Form + `zodResolver(updateProjectSettingsRequestSchema)`. **Uložiť zmeny** disabled pri `!isDirty`, `loading` počas requestu. Po úspechu `reset(response)`.
  - **Opustiť projekt:** `Button variant="outline"` vľavo dole, `disabled`, obalený `Tooltip`.
  - Chyby: `400` → `setError` podľa `details`, `404`/iná → červená notifikácia ``t(`errors.${code}`)``.
  - Stavy mimo Figmy: loading (`Skeleton` sekcií), chyba načítania s tlačidlom **Skúsiť znova**.
  - Svetlá aj tmavá téma cez `--app-color-*` tokeny. Všetky texty `projectSettingsPage.*` v `sk.json` aj `en.json`.

## Kroky

### P1. Kontrakt (orchestrátor, `feature/project-settings`)

- `projectSettings.ts` podľa rozhodnutí, export z `index.ts`.
- Unit testy: trim a `REQUIRED`/`TOO_LONG` pre názov, slug (`b2b-admin` ok; `B2B`, `-a`, `a--b`, medzera → `INVALID`), farba (`#e83e8c` → `#E83E8C`, `#FFF` a `red` → `INVALID`), `baseLanguageId` nie UUID → chyba, `protectVariables` povinné.
- **Overenie:** `pnpm --filter @locale/shared test`, `pnpm lint`, `pnpm typecheck`.

### P2. Backend (Backend Developer, worktree `agent/be-project-settings`)

- Prisma modely + migrácia `add_project`, seed projektu a člena (skill `database-migrations`).
- `routes/adminProject.routes.ts`, `controllers/adminProject.controller.ts`, `services/adminProject.service.ts` (explicitný `select`, mapovanie `toProjectSettings`), `setBaseLanguage` v `adminLanguages.service.ts`, mount `router.use('/project', …)` v `admin.routes.ts`.
- Integračné testy (`backend/test/adminProject.test.ts`): `GET` tvar vrátane `baseLanguageId`, `PATCH` uloží orezané hodnoty a farbu veľkými písmenami, `PATCH` s iným `baseLanguageId` presunie `isBase` (v DB je stále práve jeden základný), neexistujúci `baseLanguageId` → `400` a nič sa neuloží (transakcia), `404` bez projektu, `401`, `403` EDITOR, `403 CSRF_REJECTED`. Existujúce testy jazykov musia prejsť aj po vytiahnutí `setBaseLanguage`.
- `docs/api/admin-project.md`, `docs/api/README.md`, `docs/database.md` (modely `Project`, `ProjectMember`, seed).
- **Overenie:** root `pnpm lint`, `pnpm --filter backend typecheck|test|test:integration`, `check-scope.sh backend-developer`.

### P3. Frontend (Frontend Developer, worktree `agent/fe-project-settings`, paralelne s P2)

- Route `/project-settings` (`projectSettingsRoute.ts` + `.lazy.ts`) s ADMIN guardom, položka v `UserMenu`.
- `api/projectSettings/`, `QUERY_KEYS.PROJECT_SETTINGS`.
- Komponenty z rozhodnutí, hodnoty z `get_design_context` `3:1557` (skill `figma-to-code`), preklady `sk` aj `en`.
- Unit testy: predvyplnenie všetkých polí, loading, chyba + retry, validácia (prázdny názov, zlý slug, zlá farba), Uložiť disabled bez zmeny, uloženie → notifikácia a invalidácia jazykov, `400` pri poli, zmena základného jazyka v selecte, prázdny zoznam jazykov → select disabled, Opustiť projekt disabled s tooltipom, štítok Ukážka mení farbu, položka v menu iba pre ADMIN.
- `docs/frontend.md` (route, stránka, stavy).
- **Overenie:** root `pnpm lint`, `pnpm --filter frontend typecheck|test|build` (bez varovania o chunku), `check-scope.sh frontend-developer`.

### P4. Integrácia (orchestrátor, `feature/project-settings`)

- `check-scope.sh` pre obe vetvy, `git merge --no-ff --no-edit`, `pnpm install`, `pnpm db:migrate`, `pnpm verify`, `pnpm stack:up`, `api-smoke` (`/api/admin/project`: 401, 403 EDITOR, 403 CSRF, 400, 200).

### P5. E2E (E2E Tester, worktree `agent/e2e-project-settings`)

- ADMIN otvorí Nastavenia projektu z menu, vidí predvyplnené hodnoty zo seedu.
- Zmení názov, slug, farbu a prepínač → uložené aj po reloade. Na konci vráti hodnoty zo seedu.
- Zmení základný jazyk na `en` → na `/languages` má odznak ZÁKLADNÝ `en`. Vráti na `sk`.
- Neplatný slug a farba → chyba pri poli, Uložiť nič nepošle.
- Opustiť projekt je disabled.
- EDITOR nevidí položku v menu, `/project-settings` → stránka 403, `/api/admin/project` → 403. Neprihlásený → `/login`.
- Testy bežia sériovo, lebo projekt aj základný jazyk sú zdieľané s testami Jazykov.
- **Overenie:** `pnpm test:e2e` (Chromium + WebKit), `check-scope.sh e2e-tester`.

### P6. Review a vizuálne porovnanie

- Code Reviewer nad celým diffom, nálezy `high`/`medium` späť agentom.
- Orchestrátor porovná Playwright screenshot `/project-settings` s `get_screenshot` `3:1557`, rozdiely (hlavne `ColorInput`, pole Základný jazyk, Opustiť projekt) idú používateľovi.
- `docs/changelog.md`, `docs/README.md`, `docs/overview.md` (projekt už existuje ako jeden projekt), root `AGENTS.md` tabuľka Domain (Project, ProjectMember).
- Vetva `feature/project-settings` ide používateľovi na review. Merge do `main` a push iba po jeho súhlase.
- **Overenie:** `pnpm verify`, `pnpm test:e2e`, všetky body rozsahu splnené.

## Akceptačné kritériá

1. ADMIN otvorí **Nastavenia projektu** z menu používateľa na `/project-settings` a vidí názov, slug, primárnu farbu s ukážkou, základný jazyk a prepínač ochrany premenných.
2. ADMIN zmení a uloží všetky polia jedným tlačidlom **Uložiť zmeny**. Hodnoty ostanú po reloade.
3. Zmena základného jazyka sa prejaví na stránke Jazyky. V systéme je vždy práve jeden základný jazyk.
4. Neplatný názov, slug alebo farbu odmietne FE aj BE.
5. **Opustiť projekt** je viditeľné, ale disabled s tooltipom.
6. EDITOR stránku ani API nevidí (`403`).
7. Všetky texty v `sk` aj `en`, `pnpm verify` a `pnpm test:e2e` prechádzajú.

## Odpovede na otázky (2026-10-17)

Plán bol schválený, otvorené otázky sa riešia navrhnutým variantom:

1. **Slug** sa dá meniť, v MVP bez varovania.
2. Text na štítku **Ukážka** je čierny alebo biely podľa kontrastu farby (jednoduchý výpočet jasu).
3. Seed pridá za člena projektu iba seedovaného ADMIN-a.
