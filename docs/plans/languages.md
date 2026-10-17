---
title: 'Jazyky – implementačný plán (MVP)'
updated: 2026-10-17
notion_page_id:
---

# Jazyky – implementačný plán (MVP)

Obrazovka **Jazyky** podľa Figmy ([node `3-812`](https://www.figma.com/design/8mjlOXj1MXEqGwkWlf83mZ/Admin-system-for-translations?node-id=3-812&m=dev)). Modaly na pridanie, úpravu a odstránenie jazyka približne podľa screenshotov z predchádzajúceho systému (výber jazyka s vyhľadávaním, nastavenia jazyka s vlajkou, tlačidlo Odstrániť jazyk). MVP: **CRUD nad jazykmi** z pevného katalógu podporovaných jazykov. Každé odstránenie ide cez potvrdzovací modal. Postup podľa `.agents/workflows/feature.md` rovnako ako Profil: kontrakt na vetve `feature/languages`, potom BE a FE paralelne vo vlastných worktree, E2E, review. Po každom kroku checkpoint (feedback loop, `docs/`, commit, krátky report).

## Predpoklady

- **Projekty ešte neexistujú**, preto sú jazyky zatiaľ **globálny zoznam** (jedna tabuľka `Language`). Figma aj screenshoty ukazujú jazyky projektu. Keď prídu projekty, pribudne väzba projekt ↔ jazyk a táto stránka sa presunie pod projekt (mimo tohto plánu).
- **Podporované jazyky** sú pevný katalóg v `packages/shared`. Pridať sa dá iba jazyk z katalógu, ktorý ešte nie je pridaný. „Nový vlastný jazyk“ zo screenshotu nie je v rozsahu.

| Tag     | Anglický názov   | Pôvodný názov        | Vlajka |
| ------- | ---------------- | -------------------- | ------ |
| `bg`    | Bulgarian        | български            | `bg`   |
| `cs`    | Czech            | čeština              | `cz`   |
| `de-AT` | German (Austria) | Deutsch (Österreich) | `at`   |
| `en`    | English          | English              | `gb`   |
| `hr`    | Croatian         | hrvatski             | `hr`   |
| `hu`    | Hungarian        | magyar               | `hu`   |
| `ro`    | Romanian         | română               | `ro`   |
| `ru`    | Russian          | русский              | `ru`   |
| `sk`    | Slovak           | slovenčina           | `sk`   |

Tagy sú bez regiónu okrem `de-AT` (rovnako ako na screenshote). Vlajka je ISO 3166-1 kód krajiny, angličtina má britskú vlajku (rovnako ako prepínač jazyka v top bare).

## Rozsah

| Prvok                                                                           | MVP                                                                                                  |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Hlavička stránky (eyebrow „Lokalizácia“, nadpis „Jazyky“, podnadpis)            | áno, cez `PageIntro`                                                                                 |
| Tlačidlo **Pridať jazyk**                                                       | áno, otvorí modal Pridať jazyk. Disabled, ak sú pridané všetky jazyky z katalógu                     |
| Tabuľka: stĺpec **Jazyk** (vlajka, anglický názov, pod ním pôvodný názov a tag) | áno                                                                                                  |
| Odznak **ZÁKLADNÝ**                                                             | áno, pri základnom jazyku                                                                            |
| Menu `⋯` v riadku                                                               | áno: **Upraviť**, **Odstrániť** (pri základnom jazyku disabled)                                      |
| Stĺpce **Preložené**, **Na kontrolu**, **Pokrytie**                             | **nie** (preklady neexistujú, nie sú dáta)                                                           |
| Záložky Project languages / Machine translation zo screenshotu                  | **nie**                                                                                              |
| Modal **Pridať jazyk**                                                          | áno: vyhľadávací select z katalógu, už pridané jazyky disabled                                       |
| Modal **Nastavenia jazyka**                                                     | áno: anglický názov, pôvodný názov, vlajka, tag (iba na čítanie), prepínač Základný jazyk, Odstrániť |
| Potvrdenie odstránenia                                                          | áno, vždy (z menu aj z modalu)                                                                       |
| Sidebar, drobčeky, ikona `?`                                                    | **nie** (layout Fázy 1 bez sidebaru)                                                                 |

## Rozhodnutia

- **Route:** `/languages`, pod `authenticatedRoute` s `requireRole(ROLE.ADMIN)`. Lazy stránka podľa skillu `add-page`.
- **Vstup:** nová položka **Jazyky** v `UserMenu` pod položkou Používatelia, iba pre ADMIN.
- **Dátový model** (`backend/prisma/schema.prisma`, migrácia `add_language`):

  ```prisma
  model Language {
    id          String   @id @default(uuid()) @db.Uuid
    tag         String   @unique
    englishName String
    nativeName  String
    flagCode    String
    isBase      Boolean  @default(false)
    createdAt   DateTime @default(now())
    updatedAt   DateTime @updatedAt
  }
  ```

  Najviac jeden základný jazyk zaručí čiastočný unikátny index v SQL migrácii (`CREATE UNIQUE INDEX … ON "Language" ("isBase") WHERE "isBase"`), Prisma ho v schéme nevie vyjadriť.

- **Základný jazyk:**
  - Prvý pridaný jazyk sa automaticky stane základným.
  - Základný jazyk sa mení v modale Nastavenia jazyka prepínačom **Základný jazyk**. Zapnúť sa dá, vypnúť nie (iba zapnutím pri inom jazyku). BE v jednej transakcii zruší príznak pri starom a nastaví pri novom.
  - Základný jazyk sa nedá odstrániť (`409 LANGUAGE_IS_BASE`). Najprv treba nastaviť iný základný jazyk. Posledný jazyk je vždy základný, takže sa tiež nedá odstrániť.
- **Tag sa nedá upraviť.** Je to identifikátor, pod ktorým sa budú exportovať preklady, a musí ostať v katalógu. V modale je zobrazený ako disabled pole. Keď treba iný tag, jazyk sa odstráni a pridá nový.
- **Kontrakt** (`packages/shared/src/languages.ts`):
  - `SUPPORTED_LANGUAGES` (katalóg z tabuľky vyššie, `as const`), `LANGUAGE_TAGS`, `LANGUAGE_FLAG_CODES` (unikátne vlajky z katalógu).
  - `LANGUAGE_NAME_MAX_LENGTH = 100`, `languageNameSchema = z.string().trim().min(1).max(LANGUAGE_NAME_MAX_LENGTH)`.
  - `languageSchema = { id, tag, englishName, nativeName, flagCode, isBase, createdAt }` → `Language`, `languagesResponseSchema = z.array(languageSchema)`.
  - `createLanguageRequestSchema = { tag: z.enum(LANGUAGE_TAGS) }` → BE doplní názvy a vlajku z katalógu.
  - `updateLanguageRequestSchema = { englishName: languageNameSchema, nativeName: languageNameSchema, flagCode: z.enum(LANGUAGE_FLAG_CODES), isBase: z.literal(true).optional() }`. Poslaný `tag` sa ignoruje (zod ho odstráni).
  - Nové `ERROR_CODE`: `LANGUAGE_TAKEN` (tag už existuje) a `LANGUAGE_IS_BASE` (pokus odstrániť základný jazyk). Neexistujúce `id` → existujúci `NOT_FOUND`. Žiadny nový `VALIDATION_CODE`.
- **API** (router `/api/admin/languages` pod existujúcim `createAdminRouter`, takže auth aj `requireRole(ADMIN)` sú už vyriešené):
  - `GET /api/admin/languages` → `200 Language[]`, zoradené: základný prvý, potom podľa `tag`.
  - `POST /api/admin/languages` `{ tag }` → `201 Language`. `409 LANGUAGE_TAKEN`, `400 VALIDATION_ERROR` (tag mimo katalógu).
  - `PATCH /api/admin/languages/:id` → `200 Language`. `404 NOT_FOUND`, `400 VALIDATION_ERROR`.
  - `DELETE /api/admin/languages/:id` → `204`. `404 NOT_FOUND`, `409 LANGUAGE_IS_BASE`.
  - Neplatné `:id` (nie UUID) → `404 NOT_FOUND`, nie `500`.
  - `401 AUTH_UNAUTHENTICATED`, `403 FORBIDDEN` (EDITOR), `403 CSRF_REJECTED` pre zápisy rieši existujúci middleware.
- **Seed:** vytvorí `sk` (základný) a `en`, aby lokálne a v E2E nebola stránka prázdna. Iba keď je tabuľka `Language` prázdna, aby sa jazyky zmazané adminom po reštarte backendu nevracali.
- **Vlajky:** existujúca knižnica `country-flag-icons` (už ju používa `LanguageSwitcher` cez `country-flag-icons/react/3x2`), named importy iba 9 použitých vlajok. Vo Figme vlajky nie sú, takže export cez SVGR nedáva zmysel. Okrúhla vlajka v tabuľke (namiesto textového odznaku `SK` z Figmy), obdĺžniková v selecte vlajky.
- **FE:**
  - `api/languages/` (`languagesQuery`, `useCreateLanguageMutation`, `useUpdateLanguageMutation`, `useDeleteLanguageMutation`), `QUERY_KEYS.LANGUAGES()`. Po každej úspešnej mutácii `invalidateQueries(LANGUAGES)` (zmena základného jazyka mení dva riadky naraz), zelená notifikácia.
  - `LanguagesPage`, `LanguagesTable` (riadok: `LanguageFlag`, názvy, odznak, `Menu` s `⋯`), `AddLanguageModal`, `LanguageSettingsModal`, `ConfirmDeleteModal`, `LanguageFlag`.
  - **Pridať jazyk:** Mantine `Select` so `searchable`, položky „vlajka · English name – native name – tag“, už pridané jazyky `disabled` (ako na screenshote). Vyhľadáva sa v anglickom aj pôvodnom názve aj v tagu. Tlačidlá **Zrušiť** / **Pridať** (`loading` počas requestu, disabled bez výberu).
  - **Nastavenia jazyka:** React Hook Form + `zodResolver(updateLanguageRequestSchema)`, predvyplnené z riadku. Vlajka ako `Select` z `LANGUAGE_FLAG_CODES` s náhľadom vlajky. Tag disabled. Prepínač **Základný jazyk** (pri základnom jazyku zapnutý a disabled). Tlačidlá **Odstrániť jazyk** (vľavo, disabled pri základnom jazyku), **Zrušiť**, **Uložiť** (`!isDirty` → disabled).
  - **Potvrdenie odstránenia:** vlastný malý modal (projekt nemá `@mantine/modals`, kvôli jednému dialógu ho nepridávame). Text „Naozaj chcete odstrániť jazyk {{name}} ({{tag}})?“, tlačidlá **Zrušiť** a červené **Odstrániť** (`loading`). Z modalu Nastavenia sa po potvrdení zatvoria oba modaly.
  - Chyby: `400` → `setError` podľa `details`, `409`/`404`/iná → červená notifikácia ``t(`errors.${code}`)``, pri `404` aj `invalidateQueries` (jazyk medzitým zmazal iný admin).
  - Stavy mimo Figmy: loading (`Skeleton` riadkov), prázdny stav („Zatiaľ nemáte žiadne jazyky“ + tlačidlo Pridať jazyk), chyba načítania s tlačidlom **Skúsiť znova**.
  - Svetlá aj tmavá téma cez `--app-color-*` tokeny (pravidlá v `frontend-conventions`).
  - Názvy jazykov sa zobrazujú tak, ako sú uložené (nie sú v i18n, sú to dáta). Všetky ostatné texty `languagesPage.*` v `sk.json` aj `en.json`, nové chybové kódy v `errors.*`.

## Kroky

### L1. Kontrakt (orchestrátor, `feature/languages`)

- `languages.ts` podľa rozhodnutí, export z `index.ts`, nové `ERROR_CODE`.
- Unit testy: katalóg má 9 jazykov s unikátnymi tagmi, `createLanguageRequestSchema` odmietne tag mimo katalógu, trim a `REQUIRED`/`TOO_LONG` pre názvy, `flagCode` mimo zoznamu → `INVALID`, `isBase: false` → chyba, `tag` v `PATCH` tele sa odstráni.
- **Overenie:** `pnpm --filter @locale/shared test`, `pnpm lint`, `pnpm typecheck`.

### L2. Backend (Backend Developer, worktree `agent/be-languages`)

- Prisma model + migrácia s čiastočným unikátnym indexom, seed `sk` + `en` (skill `database-migrations`).
- `routes/adminLanguages.routes.ts`, `controllers/adminLanguages.controller.ts`, `services/adminLanguages.service.ts` (explicitný `select`, mapovanie `toLanguage`, transakcia pri zmene základného jazyka, prvý jazyk = základný), mount `router.use('/languages', …)` v `admin.routes.ts`.
- Integračné testy (`backend/test/adminLanguages.test.ts`): `GET` tvar a poradie, `POST` doplní názvy z katalógu, prvý jazyk je základný, `409 LANGUAGE_TAKEN`, `400` tag mimo katalógu, `PATCH` uloží orezané názvy a vlajku, `PATCH isBase: true` presunie príznak (v DB je stále práve jeden základný), `tag` v tele sa ignoruje, `DELETE` `204`, `DELETE` základného `409 LANGUAGE_IS_BASE`, `404` pre neexistujúce aj ne-UUID `id`, `401` bez session, `403` pre EDITOR, `403 CSRF_REJECTED` pre `POST`/`PATCH`/`DELETE`.
- `docs/api/admin-languages.md`, `docs/api/README.md`, `docs/database.md` (model `Language`, index, seed).
- **Overenie:** root `pnpm lint`, `pnpm --filter backend typecheck|test|test:integration`, `check-scope.sh backend-developer`.

### L3. Frontend (Frontend Developer, worktree `agent/fe-languages`, paralelne s L2)

- Route `/languages` (`languagesRoute.ts` + `languagesRoute.lazy.ts`) s ADMIN guardom, položka v `UserMenu`.
- `api/languages/`, `QUERY_KEYS.LANGUAGES`.
- `LanguagesPage` + komponenty z rozhodnutí, hodnoty z `get_design_context` `3:812` (skill `figma-to-code`), ikona `+` a `⋯` cez `generate-icons`, preklady `sk` aj `en`.
- Unit testy: zoznam s odznakom ZÁKLADNÝ, loading, prázdny stav, chyba + retry, pridanie (pridané jazyky disabled v selecte, úspech → notifikácia), Pridať jazyk disabled pri plnom katalógu, úprava (predvyplnenie, tag disabled, validácia, `400` pri poli, Uložiť disabled bez zmeny), zmena základného jazyka, odstránenie z menu aj z modalu vždy cez potvrdenie, Zrušiť v potvrdení nič nezmaže, Odstrániť disabled pri základnom jazyku, `409` → notifikácia, položka v menu iba pre ADMIN.
- `docs/frontend.md` (route, stránka, stavy).
- **Overenie:** root `pnpm lint`, `pnpm --filter frontend typecheck|test|build` (bez varovania o chunku), `check-scope.sh frontend-developer`.

### L4. Integrácia (orchestrátor, `feature/languages`)

- `check-scope.sh` pre obe vetvy, `git merge --no-ff --no-edit`, `pnpm install`, `pnpm db:migrate`, `pnpm verify`, `pnpm stack:up`, `api-smoke` (`/api/admin/languages`: 401, 403 EDITOR, 403 CSRF, 400, 409, 201, 204).

### L5. E2E (E2E Tester, worktree `agent/e2e-languages`)

- ADMIN otvorí Jazyky z menu, vidí `sk` ako základný a `en`.
- Pridá `ru` → riadok sa objaví, `ru` je v selecte potom disabled. Upraví anglický názov a vlajku → uložené aj po reloade.
- Nastaví `ru` ako základný → odznak sa presunie. Vráti základný späť na `sk`.
- Odstráni `ru`: Zrušiť v potvrdení → riadok ostane, Odstrániť → riadok zmizne. Odstrániť pri základnom jazyku je disabled.
- EDITOR nevidí položku v menu, `/languages` → stránka 403, `/api/admin/languages` → 403. Neprihlásený → `/login`.
- Každý prehliadač má vlastný tag (`chromium` → `ru`, `webkit` → `hu`, API smoke → `ro`), seed `sk`/`en` nemenia (okrem dočasnej zmeny základného jazyka, ktorú vrátia). Základný jazyk je iba jeden, preto testy jazykov držia Postgres advisory lock a v rámci projektu bežia sériovo.
- **Overenie:** `pnpm test:e2e` (Chromium + WebKit), `check-scope.sh e2e-tester`.

### L6. Review a vizuálne porovnanie

- Code Reviewer nad celým diffom, nálezy `high`/`medium` späť agentom.
- Orchestrátor jednorazovo porovná Playwright screenshot `/languages` s `get_screenshot` `3:812`, rozdiely idú používateľovi (zhodu s Figmou potvrdzuje používateľ).
- `docs/changelog.md`, `docs/README.md`, `docs/overview.md` (pojem Jazyk), root `AGENTS.md` tabuľka Domain (riadok Language).
- Vetva `feature/languages` ide používateľovi na review. Merge do `main` a push iba po jeho súhlase.
- **Overenie:** `pnpm verify`, `pnpm test:e2e`, všetky body rozsahu splnené.

## Akceptačné kritériá

1. ADMIN otvorí **Jazyky** z menu používateľa na `/languages` a vidí zoznam jazykov so základným jazykom označeným odznakom ZÁKLADNÝ.
2. ADMIN pridá jazyk z katalógu 9 podporovaných jazykov. Jazyk, ktorý už existuje, sa nedá pridať (FE aj BE).
3. ADMIN upraví anglický a pôvodný názov, vlajku a nastaví jazyk ako základný. V systéme je vždy práve jeden základný jazyk (ak existuje aspoň jeden jazyk).
4. Odstránenie jazyka vždy vyžaduje potvrdenie. Základný jazyk sa nedá odstrániť.
5. EDITOR stránku ani API nevidí (`403`).
6. Všetky texty v `sk` aj `en`, `pnpm verify` a `pnpm test:e2e` prechádzajú.

## Odpovede na otázky (2026-10-17)

Návrh plánu bol schválený, otvorené otázky sa riešia odporúčaným variantom:

1. Jazyky spravuje **iba ADMIN** (stránka aj API). EDITOR zoznam nevidí.
2. **Základný jazyk** sa zavádza už teraz: práve jeden, prvý pridaný je základný, nedá sa odstrániť.
3. **Tag** je v modale Nastavenia iba na čítanie.
4. **Seed** vytvorí `sk` (základný) a `en`.
5. V tabuľke sa zobrazuje **okrúhla vlajka**, nie textový odznak z Figmy.
6. **Tagy** sú bez regiónu okrem `de-AT`.
7. **Seed** pridá `sk` a `en` iba do prázdnej tabuľky `Language` (doplnené po L2, keď sa ukázalo, že `upsert` by po reštarte vrátil zmazané jazyky).
