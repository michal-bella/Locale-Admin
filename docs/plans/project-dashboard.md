---
title: 'Prehľad projektu (Dashboard) – implementačný plán'
updated: 2026-10-20
notion_page_id:
---

# Prehľad projektu (Dashboard)

## Kontext

Projekt má dnes stránky Preklady, Nastavenia, Jazyky a Členovia. Chýba miesto, kde člen na jeden pohľad vidí **stav projektu**: koľko je preložené, ktoré jazyky zaostávajú, kto čo naposledy menil a ako živý je projekt v čase. Tento plán pridáva stránku **Prehľad** (Figma [3-475](https://www.figma.com/design/8mjlOXj1MXEqGwkWlf83mZ/Admin-system-for-translations?node-id=3-475), inšpirácia Tolgee: štatistiky, jazyky s progresom, aktivita, denný graf).

Postup podľa `.agents/workflows/feature.md` na vetve `feature/project-dashboard`. Po každom míľniku checkpoint (`pnpm verify`, `docs/`, commit, krátky report).

### Požiadavky používateľa

- Prehľad **nie je** hlavná stránka projektu: `/projects/$projectSlug` ďalej presmeruje na `/translations`.
- V sidebare je **druhá** položka (Preklady, **Prehľad**, Nastavenia projektu, Jazyky, Členovia).
- **Bez tlačidiel Importovať a Exportovať** (na rozdiel od Figmy). Namiesto nich primárne tlačidlo **Otvoriť preklady**.
- Zo stránky sa dá preklikať na Preklady, ideálne rovno s filtrom (jazyk, nepreložené, zmeny používateľa).

### Rozsah

| Prvok                                                                 | Teraz                                    |
| --------------------------------------------------------------------- | ---------------------------------------- |
| Hlavička (eyebrow PREHĽAD PROJEKTU, názov, podnadpis, Otvoriť preklady) | áno                                      |
| 4 štatistické karty: Kľúče, Preložené, Jazyky, Členovia               | áno                                      |
| Stav jazykov (progres po jazykoch, Spravovať jazyky)                  | áno                                      |
| Posledná aktivita (feed zmien)                                        | áno, **nová tabuľka udalostí**           |
| Graf dennej aktivity (7 / 30 / 90 dní)                                 | áno                                      |
| Najaktívnejší členovia za obdobie                                     | áno (max. 5 pod grafom), rozhodnutie 6   |
| Samostatná stránka Aktivita (Figma ju má v sidebare), filtre, diff hodnôt | nie, neskôr; dáta sa na ňu ukladajú už teraz |
| Úlohy, Reviewed, Tagy (Tolgee)                                        | nie, v aplikácii neexistujú              |

## Čo sa dá vytiahnuť z databázy dnes

| Údaj                                   | Zdroj                                                                 | Presnosť |
| -------------------------------------- | --------------------------------------------------------------------- | -------- |
| Počet kľúčov, nové kľúče za 30 dní     | `TranslationKey` (`count`, `createdAt`)                               | presné   |
| % preložených kľúčov (riadkov)         | `Translation` – kľúč je preložený, keď má hodnotu v každom jazyku (definícia z domény, extended view) | presné |
| Preložené po jazykoch                  | `Translation` `GROUP BY languageId WHERE value IS NOT NULL`           | presné   |
| Počet reťazcov (vyplnených buniek), slová v základnom jazyku | `Translation`                                   | presné, len ako doplnok v karte |
| Jazyky, základný jazyk                 | `ProjectLanguage`                                                     | presné   |
| Členovia, z toho administrátori        | `ProjectMember` + `User.role`                                         | presné   |
| **História zmien, denná aktivita**     | **neexistuje** – `Translation.updatedAt/updatedById` drží len *poslednú* zmenu bunky, import, jazyky ani členov nezaznamenáva | – |

Preto plán pridáva tabuľku udalostí. Bez nej by graf aj feed ukazovali len „posledné dotknutie“ buniek a staršie zmeny tej istej bunky by sa stratili.

## Dátový model (nová migrácia)

```prisma
enum ACTIVITY_TYPE {
  PROJECT_CREATED
  PROJECT_UPDATED        // názov, farba, ochrana premenných
  LANGUAGE_ADDED
  LANGUAGE_REMOVED
  BASE_LANGUAGE_CHANGED
  MEMBER_ADDED
  MEMBER_REMOVED         // aj odchod z projektu
  KEYS_IMPORTED
  KEY_UPDATED            // popis, plurál
  TRANSLATION_UPDATED
}

/// Append-only záznam zmien projektu pre Prehľad a budúcu stránku Aktivita. Zapisuje sa v tej istej transakcii ako zmena.
model ActivityEvent {
  id        String        @id @default(uuid()) @db.Uuid
  projectId String        @db.Uuid
  project   Project       @relation(fields: [projectId], references: [id], onDelete: Cascade)
  userId    String?       @db.Uuid
  user      User?         @relation(fields: [userId], references: [id], onDelete: SetNull)
  type      ACTIVITY_TYPE
  /// Snímka údajov v čase zmeny (tag jazyka, namespace + názov kľúča, meno člena, počty importu, stará/nová hodnota), aby feed
  /// ostal čitateľný aj po zmazaní kľúča, jazyka alebo používateľa.
  payload   Json
  /// Počet zmenených prekladov, ktoré udalosť reprezentuje (import = počet zapísaných buniek, úprava = 1); z neho sa ráta graf.
  count     Int           @default(1)
  createdAt DateTime      @default(now())

  @@index([projectId, createdAt(sort: Desc)])
}
```

- Payload má zod schému per `type` v `packages/shared` (diskriminovaná únia), BE ju pri zápise validuje, FE podľa nej skladá preložený text. Žiadny voľný text z BE sa nezobrazuje (pravidlo 3/4).
- Zápis udalostí: helper `recordActivity(tx, …)` v `backend/src/lib/activity.ts`, volaný zo služieb: vytvorenie projektu, `PATCH settings`, pridanie / zmazanie jazyka a zmena základného, pridanie / odobratie / odchod člena, `PUT …/translations/:languageId` (len ak sa hodnota naozaj zmenila), `PATCH …/keys/:keyId`, import (jedna udalosť za import). Zmena poradia jazykov alebo projektov sa **nezaznamenáva** (šum).
- Spätné doplnenie: rozhodnutie 2.

## Kontrakt (`packages/shared/src/dashboard.ts`, `activity.ts`)

- `dashboardResponseSchema`: `{ keys: { total, createdLast30Days }, translatedKeys, strings: { filled, total }, baseWords, languages: { id, tag, isBase, translated }[], members: { total, admins } }` (jazyky v poradí projektu: základný prvý, potom `position`).
- `activityEventSchema` (diskriminovaná únia podľa `type`) + `activityListQuerySchema` `{ cursor?: string, limit: 1–50, default 20 }`, odpoveď `{ items, nextCursor }` (keyset cez `createdAt, id`).
- `activityDailyQuerySchema` `{ range: '7d' | '30d' | '90d' (default 30d), timeZone: IANA zóna (validácia cez `Intl.supportedValuesOf('timeZone')`) }`, odpoveď `{ days: { date: 'YYYY-MM-DD', changes: number }[], contributors: { user, changes }[] }` – každý deň obdobia, aj nulový.
- Nové chybové kódy netreba (neplatný query → existujúci `VALIDATION_ERROR`, nečlen → 404 ako všade).

## API

| Metóda | Cesta                                        | Popis                                                       |
| ------ | -------------------------------------------- | ----------------------------------------------------------- |
| GET    | `/api/projects/:projectId/dashboard`         | štatistiky a stav jazykov, jeden request                    |
| GET    | `/api/projects/:projectId/activity`          | feed udalostí, keyset stránkovanie                          |
| GET    | `/api/projects/:projectId/activity/daily`    | denné súčty `count` za obdobie v zóne používateľa + top členovia |

- Prístup: `requireProjectAccess` (člen alebo `ADMIN`), inak 404. Všetko read-only, každý člen.
- Denné súčty: `generate_series` dní v zadanej zóne `LEFT JOIN` agregácia `date_trunc('day', "createdAt" AT TIME ZONE $tz)`; 90 dní je max., index `(projectId, createdAt)` stačí.
- `dashboard`: 4–5 agregačných SQL v `Promise.all`, žiadne čítanie riadkov do pamäte (tisíce kľúčov × 9 jazykov = desiatky tisíc buniek, `GROUP BY` v Postgres).

## Frontend

- Route `/projects/$projectSlug/dashboard` (lazy, `projectDashboardRoute.ts` + `.lazy.ts`), `projectIndexRoute` sa **nemení** (presmerovanie na Preklady ostáva).
- Sidebar: `NavItem` **Prehľad** hneď pod Preklady, nová ikona `LayoutGrid` z Figmy (SVGR, skill `figma-to-code`).
- `DashboardPage` (`pages/DashboardPage/`) podľa Figmy 3-475:
  - **Hlavička**: `PageIntro` s eyebrow „PREHĽAD PROJEKTU“, názov projektu, podnadpis „Aktuálny stav prekladov, jazykov a posledných zmien.“; vpravo `ButtonLink` **Otvoriť preklady** (ikona `ArrowRight`). Žiadny Import ani Export.
  - **Karty** (zdieľaný vzhľad so `StatCard` z `TranslationStats`, vytiahnuť ho do `components/StatCard`): Kľúče (+N tento mesiac), Preložené % (X z Y kľúčov, klik → Preklady s `status=UNTRANSLATED`), Jazyky (N, 1 zdrojový), Členovia (N, M administrátorov, klik → Členovia).
  - **Stav jazykov**: riadok na jazyk (vlajka, názov, „221 z 248 preložených“, %, progres), odkaz **Spravovať jazyky** → Jazyky. Klik na jazyk → Preklady s cieľovým jazykom a filtrom Nepreložené (`?target=<tag>&status=UNTRANSLATED`); presné správanie v extended view overiť v míľniku D.
  - **Posledná aktivita**: 10 udalostí zoskupených po dňoch (ako Tolgee), avatar s iniciálami, preložená veta podľa `type`, relatívny čas (`Intl.RelativeTimeFormat`), tlačidlo **Načítať ďalšie** (`useInfiniteQuery`). Udalosť úpravy prekladov má odkaz na Preklady s `updatedBy=<user>&updatedWithin=DAY`.
  - **Denná aktivita**: stĺpcový graf (rozhodnutie 4) s prepínačom 7 / 30 / 90 dní (`SegmentedControl`), tooltip „20. 10. 2026: 6 zmien“, popis pre čítačky (súhrn + skrytá tabuľka). Pod ním **Najaktívnejší členovia** za obdobie (max. 5).
  - Stavy: skeletony pri načítaní, prázdny projekt („Zatiaľ žiadne kľúče, importujte CSV na stránke Preklady“ – odkaz, nie tlačidlo importu), prázdna aktivita, chyba cez `RouteError`.
- Hooky `dashboardQueryOptions`, `useActivityInfiniteQuery`, `activityDailyQueryOptions` s `QUERY_KEYS`; mutácie prekladov, importu, jazykov a členov invalidujú `dashboard` a `activity` daného projektu.
- i18n `sk`, `en`, `cs` (názvy udalostí s pluralizáciou).

## Míľniky

### A – Kontrakt, model a zápis udalostí (`backend-developer`)

1. `packages/shared`: schémy dashboardu, aktivity a payloadov + unit testy.
2. Prisma `ActivityEvent`, migrácia, seed s ukážkovými udalosťami za posledných 30 dní (skill `database-migrations`).
3. `lib/activity.ts` a volania vo všetkých službách z kapitoly Dátový model, v tej istej transakcii.
4. Integračné testy: každá mutácia zapíše presne jednu udalosť so správnym payloadom; nezmenená hodnota prekladu nezapíše nič; rollback zmeny nezapíše udalosť.
5. `docs/` (dátový model, rozhodnutia).

**Overenie:** `pnpm verify`; `api-smoke`: úprava prekladu → riadok v `ActivityEvent`.

### B – Čítacie endpointy (`backend-developer`)

1. `dashboard`, `activity`, `activity/daily` (route, controller, service).
2. Integračné testy: počty a % na fixture (aj prázdny projekt, jazyk bez prekladov), keyset stránkovanie, nulové dni, hranica dňa v `Europe/Bratislava` vs. UTC, nečlen → 404, neplatná zóna → 400.
3. `docs/api/dashboard.md`, `docs/changelog.md`.

**Overenie:** `pnpm verify`, `api-smoke`.

### C – Graf: výber knižnice (orchestrátor, pred D)

Overiť v aktuálnych docs (Context7) `@mantine/charts` pre Mantine 9.6 (postavené na Recharts, sedí s témou a dark mode) a veľkosť v lazy chunku stránky. Ak nesedí verzia, fallback: vlastný SVG stĺpcový graf (30 stĺpcov, bez závislosti).

### D – Frontend stránka (`frontend-developer`, paralelne s B po A)

1. Route, sidebar položka a ikona, `StatCard` vytiahnutý zo `TranslationStats` (bez zmeny jeho vzhľadu na Prekladoch).
2. `DashboardPage` a sekcie, hooky, invalidácie, i18n.
3. Porovnanie s Figmou (potvrdí používateľ), svetlá aj tmavá téma, mobil.
4. Unit testy: karty, percentá a zaokrúhlenie, texty udalostí pre každý `type`, odkazy na Preklady s filtrami, prázdne stavy.
5. `docs/frontend.md`.

**Overenie:** `pnpm verify`, preview v prehliadači.

### E – E2E a review (`e2e-tester`, `accessibility-reviewer`, `code-reviewer`)

1. E2E: Prehľad je 2. v sidebare, `/projects/x` stále otvorí Preklady; úprava prekladu sa objaví v aktivite a v grafe dnes; klik na jazyk otvorí Preklady s filtrom; na stránke nie je Import ani Export.
2. Axe screen Prehľadu, a11y review grafu (textová alternatíva), code review vetvy.
3. Merge do `main` po odsúhlasení.

## Rozhodnutia z 2026-10-20

Všetky potvrdil používateľ.

1. **Nová tabuľka `ActivityEvent`** namiesto odhadu z `Translation.updatedAt`. Bez nej nie je história ani poctivý graf.
2. **Spätné doplnenie**: len `PROJECT_CREATED` z `Project.createdAt` (aplikácia je zatiaľ vo vývoji, stratu staršej histórie netreba riešiť). Úpravy z `Translation.updatedAt` nedoplňovať – je to len posledná zmena bunky a graf by klamal. Aktivita sa teda začne zbierať od nasadenia.
3. **Stará a nová hodnota v `TRANSLATION_UPDATED`** sa ukladá už teraz (dodatočne sa získať nedá), zobrazovať až na budúcej stránke Aktivita (Tolgee „Differences“).
4. **Graf ako stĺpce, nie vyhladená čiara** (Tolgee): denné počty sú diskrétne, vyhladená krivka ukazuje aktivitu aj v dňoch, keď žiadna nebola.
5. **Graf ráta zmenené preklady (`count`)**, nie počet udalostí: import 90 prekladov = 90, nie 1. Feed naopak ukáže import jedným riadkom.
6. **Najaktívnejší členovia** pod grafom – áno, max. 5 za zvolené obdobie.
7. **Retencia udalostí**: zatiaľ bez mazania (stovky až tisíce riadkov mesačne na projekt).
