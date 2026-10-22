---
title: 'Verzie ako kópie prekladov – implementačný plán'
updated: 2026-10-22
notion_page_id:
---

# Verzie ako kópie prekladov

## Kontext

Plán [`translation-versions.md`](./translation-versions.md) zaviedol verziu ako **štítok**: kľúč nesie verziu, v ktorej vznikol, bunka verziu, v ktorej bola naposledy zapísaná, a filter Verzia ukazuje „prácu verzie“. Pri skúšaní sa ukázalo, že to nezodpovedá tomu, ako editori pracujú: chcú vidieť **celú tabuľku prekladov verzie** (verzia 2.44 má 2 300 kľúčov, do 2.45 pribudne 100, tabuľka verzie 2.45 má 2 400 kľúčov), filter „celý projekt“ nedáva zmysel a diff je doplnková informácia, nie základný pohľad.

Tento plán **nahrádza model štítkov modelom kópií**: každá verzia má vlastnú, úplnú množinu kľúčov a buniek pre všetky jazyky projektu. Verzia vzniká prázdna, naplní ju import (ktorý definuje jej množinu kľúčov a skopíruje preklady z predchádzajúcej verzie), zápisy idú vždy len do zvolenej verzie a nikdy sa nešíria. Diff = porovnanie verzie s predchádzajúcou. Žiadny merge, žiadna história v rámci verzie.

Postup podľa `.agents/workflows/feature.md` na vetve `feature/version-snapshots`. Po každom míľniku checkpoint (`pnpm verify`, `docs/`, commit, krátky report). Aplikácia je vo vývoji: existujúce dáta sa **nemigrujú**, databáza sa resetuje (`pnpm db:reset`) a seed vytvorí projekty nanovo aj s verziami.

### Požiadavky používateľa (odpovede 2026-10-22)

- Každá verzia má v tabuľke všetky kľúče a všetky jazyky; tri verzie = trikrát uložená tabuľka. Výkon pri desaťtisícoch buniek na verziu nie je prekážka.
- Verzia vytvorená dopredu je **prázdna**, nič sa nekopíruje automaticky; naplní ju až ručný import.
- **Import definuje množinu kľúčov** verzie. Opakovaný import do tej istej verzie odstráni kľúče, ktoré v súbore nie sú (aj s prekladmi); náhľad to vopred ukáže.
- Každý import má verziu; voľba „Bez verzie“ zaniká. Projekt bez verzií je prázdny projekt.
- Jazyky ostávajú na projekte: pridaný jazyk je vo všetkých verziách nepreložený, odobraný zmizne všade.
- Verziu, ktorá nie je aktuálna, môže `ADMIN` zmazať aj s dátami.
- Diff: filter „Zobraziť len zmeny“ ukáže riadky verzie pridané alebo zmenené oproti predchádzajúcej verzii. Kľúče odstránené oproti predchádzajúcej verzii sa v tabuľke **nezobrazujú** (nie sú jej súčasťou).
- Export je predvolene celý súbor verzie; checkbox „Len zmeny oproti predchádzajúcej verzii“ (predvolene vypnutý).
- Aktuálna verzia = tá s dnešným dátumom v okne; nikdy nie sú dve. Verzia **mimo svojho okna** (pred začiatkom alebo po konci) sa pre editora správa ako uzamknutá. Importy robia vývojári až po uzamknutí predchádzajúcej verzie (nevaliduje sa).
- Spätné zmeny v staršej verzii po importe novšej robí iba `ADMIN`; neskôr pribudne porovnanie dvoch verzií (zmeny v nižšej verzii po importe vyššej), preto verzia ukladá čas posledného importu.
- Prehľad, aktivita a upozornenia na premenné sú za jednu verziu (predvolene aktuálnu).

### Rozhodnutia

| #   | Rozhodnutie                                                                                                                                                                                                                                                                                                                                              | Prečo                                                                                                                                                                                 |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Verzia vlastní kľúče a bunky.** `TranslationKey.versionId` je povinné, unikátnosť kľúča je `(versionId, namespace, name)`. Bunky patria kľúču, teda verzii. Mazanie verzie ide kaskádou (`onDelete: Cascade`).                                                                                                                                         | Tabuľka verzie je úplná a nezávislá; zoznam, štatistiky, export a diff čítajú vždy jednu verziu.                                                                                      |
| 2   | **Predchádzajúca verzia** (`previous`) = verzia toho istého projektu s najväčším `startsAt` menším ako `startsAt` danej verzie (pri zhode podľa `createdAt`). Odvodzuje sa, neukladá sa. Prvá verzia projektu predchodcu nemá.                                                                                                                             | Poradie verzií dáva dátum začiatku; stačí pre import aj diff.                                                                                                                         |
| 3   | **Import do verzie** v jednej transakcii: množina kľúčov verzie = kľúče zo súboru. Kľúč, ktorý verzia už má, sa aktualizuje; kľúč, ktorý má predchádzajúca verzia a táto nie, sa skopíruje **so všetkými jazykmi** a potom prepíše vyplnenými bunkami zo súboru; nový kľúč dostane len hodnoty zo súboru; kľúče verzie chýbajúce v súbore sa zmažú. Prázdna bunka v súbore nič nemaže (ako dnes). `ProjectVersion.importedAt` = čas posledného importu. | Verzia po importe obsahuje presne to, čo je v kóde, s prekladmi, ktoré editori dokončili v predchádzajúcej verzii do chvíle importu.                                                   |
| 4   | **Náhľad importu** (`POST …/imports/preview`) dostane `versionId` a vráti okrem dnešných počtov aj: `copiedFromPrevious` (kľúče prevzaté z predchádzajúcej verzie), `removed` (kľúče verzie, ktoré v súbore nie sú, s ich počtom a prvými názvami) a `previousVersion` (`{ id, name }` alebo `null`). Krok kontroly ukáže odstránené kľúče ako varovanie. | Import robí vývojár a musí vidieť, čo zmaže.                                                                                                                                           |
| 5   | **Zápisy** (úprava bunky, Pridať kľúč, Upraviť kľúč, import) idú len do verzie v požiadavke (`versionId` povinné). Nič sa nešíri do iných verzií.                                                                                                                                                                                                         | Žiadny merge; prekryv sprintov rieši disciplína importu po uzamknutí.                                                                                                                 |
| 6   | **Uzamknutie pre editora** = `lock = LOCKED ∨ (lock = AUTO ∧ dnes ∉ ⟨startsAt, endsAt⟩)`. `UNLOCKED` otvára verziu bez ohľadu na dátum. `ADMIN` zapisuje vždy. Stav verzie: **Pripravuje sa** (pred `startsAt`), **Prebieha**, **Uzamknutá** (po `endsAt` alebo ručne); odomknutá po termíne zostáva **Prebieha** s poznámkou ako dnes. 409 `PROJECT_VERSION_LOCKED` platí aj pre verziu pred začiatkom. | Používateľ: verzia mimo svojho okna sa pre editora správa ako uzamknutá.                                                                                                              |
| 7   | **Zoznam prekladov** vždy pre jednu verziu: `GET …/translations?versionId=` povinné; `stats`, `namespaces`, `editors`, upozornenia a `warnings` sú za verziu. `?version=ALL`, `versionScope` a chip verzie pri kľúči zanikajú. Na stránke Preklady je verzia povinný stav v URL, predvolene aktuálna, inak najnovšia podľa `startsAt`; projekt bez verzií ukáže prázdny stav s výzvou vytvoriť verziu a importovať. | Jedna tabuľka = jedna verzia.                                                                                                                                                          |
| 8   | **Diff** = porovnanie s predchádzajúcou verziou podľa `(namespace, name)`: kľúč **pridaný** (predchodca ho nemá), bunka **zmenená** (hodnota sa líši, `null` vs hodnota je zmena), kľúč **zmenený** (aspoň jedna zmenená bunka alebo zmenený popis/plurál). `GET …/translations?diff=true` vráti len pridané a zmenené kľúče a v položke `diff: { added: boolean, changedLanguageIds: string[] }`; bez `diff` sa `diff` neposiela. Prvá verzia projektu: všetko pridané. Odstránené kľúče nie sú v tabuľke; ich počet vráti `GET …/versions/:id/diff` (`{ previousVersion, added, changed, removed }`) pre banner. | Používateľ chce vidieť len zmeny ako filter; odstránené kľúče nechce v tabuľke.                                                                                                        |
| 9   | **Export** `GET …/export?versionId=` vráti celý súbor verzie; `diffOnly=true` vráti len pridané a zmenené kľúče (rovnaká množina ako filter diffu). `versionScope` zaniká.                                                                                                                                                                                 | Release vetva dostane vždy celý súbor; diff je pomôcka.                                                                                                                              |
| 10  | **Mazanie verzie** `DELETE …/versions/:id` (`ADMIN`): povolené pre verziu, ktorá nie je aktuálna; aktuálnu 409 `PROJECT_VERSION_CURRENT`. Zmaže kľúče aj bunky kaskádou, zapíše `VERSION_DELETED`. Potvrdenie v UI s počtom kľúčov.                                                                                                                     | Omylom vytvorená alebo zle importovaná verzia sa musí dať odstrániť.                                                                                                                  |
| 11  | **Prehľad** (`/dashboard`), aktivita po dňoch, najaktívnejší členovia a stav jazykov sú za verziu z query (`versionId`, predvolene aktuálna); zoznam aktivít projektu zostáva za projekt a každá udalosť nesie `version: { id, name }`.                                                                                                                  | Používateľ: prehľad ukazuje stav aktuálnej verzie.                                                                                                                                    |
| 12  | **Jazyky** ostávajú `ProjectLanguage` na projekte. Pridanie jazyka nevytvára riadky (chýbajúci riadok = nepreložené), odobratie zmaže bunky vo všetkých verziách kaskádou.                                                                                                                                                                                | Používateľ: jazyky viazané na projekt.                                                                                                                                                 |
| 13  | **Verzia bez importu** je prázdna: zoznam ukáže prázdny stav „Verzia zatiaľ nemá import“ s tlačidlom Importovať (`ADMIN`); Pridať kľúč je dostupné až po prvom importe (`importedAt` nastavené), inak 409 `PROJECT_VERSION_EMPTY`.                                                                                                                       | Používateľ: žiadne automatické kopírovanie, verziu naplní iba import.                                                                                                                  |
| 14  | Existujúce dáta sa nemigrujú: migrácia `version_snapshots` dáta premaže (`TRUNCATE` kľúčov a buniek, nové stĺpce a unikátnosť), seed vytvorí demo projekty s dvoma verziami (uzamknutá predchádzajúca + aktuálna) a importom. E2E fixtures dostanú verziu.                                                                                                  | Používateľ: fáza vývoja, projekty sa môžu vytvoriť nanovo.                                                                                                                             |

## Dátový model (migrácia `version_snapshots`)

```prisma
model ProjectVersion {
  // … ako dnes (name, startsAt, endsAt, lock, createdBy, createdAt, updatedAt)
  /// Time of the last import; `null` = empty version (no keys yet). Later used to compare late changes of an older version.
  importedAt   DateTime?
  keys         TranslationKey[]
}

model TranslationKey {
  id             String         @id @default(uuid()) @db.Uuid
  projectId      String         @db.Uuid   // ponechané pre jednoduché dopyty za projekt a kaskádu
  versionId      String         @db.Uuid
  version        ProjectVersion @relation(fields: [versionId], references: [id], onDelete: Cascade)
  namespace      String         @default("")
  name           String
  description    String?
  pluralVariable String?
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt
  translations   Translation[]

  @@unique([versionId, namespace, name])
  @@index([projectId])
}

model Translation {
  // … ako dnes, bez `versionId` (verziu určuje kľúč)
  @@id([keyId, languageId])
  @@index([languageId])
}
```

`ActivityEvent` dostane `versionId String? @db.Uuid` (`SetNull`) a `payload` udalostí prekladov nesie `version: { id, name }`. Nové typy udalostí: `VERSION_DELETED`.

Index `(versionId, namespace, name)` pokrýva zoznam, diff (join predchodcu podľa `namespace, name`) aj import. Pri 2 400 kľúčoch × 8 jazykov je verzia ~20 000 buniek; kópia pri importe je jeden `INSERT … SELECT`.

## Kontrakty (`packages/shared`)

| Súbor                | Zmena                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `projectVersions.ts` | `ProjectVersion.importedAt: string \| null`, `keyCount: number`; `isVersionLocked(version, today)` zahrnie aj „pred `startsAt`“; `getVersionState` nezmenený; `versionDiffSummarySchema` (`previousVersion`, `added`, `changed`, `removed`).                                                                                                                             |
| `translations.ts`    | `translationsQuerySchema.versionId` **povinné**, `diff: boolean` (voliteľné); `translationListItemSchema.diff?: { added, changedLanguageIds }`; `version` v položke zaniká; `updateTranslationRequestSchema.versionId` zaniká (verzia je v kľúči); `createTranslationKeyRequestSchema.versionId` povinné.                                                               |
| `imports.ts`         | `importPreviewRequestSchema.versionId` povinné; `ImportPreviewResponse` + `previousVersion`, `copiedFromPrevious`, `removed: { total, names: string[] }`; `importRequestSchema.versionId` povinné; `ImportResponse.keysRemoved`.                                                                                                                                           |
| `exports.ts`         | `versionId` povinné, `versionScope` → `diffOnly: boolean` (predvolene `false`).                                                                                                                                                                                                                                                                                           |
| `dashboard.ts`       | `dashboardQuerySchema.versionId` (voliteľné, predvolene aktuálna), odpoveď nesie `version`.                                                                                                                                                                                                                                                                              |
| `activity.ts`        | `VERSION_DELETED`; `version` v payloade importu, úpravy prekladu a kľúča.                                                                                                                                                                                                                                                                                                |
| `errors.ts`          | `PROJECT_VERSION_CURRENT` (409, mazanie aktuálnej), `PROJECT_VERSION_EMPTY` (409, Pridať kľúč do verzie bez importu), `PROJECT_VERSION_REQUIRED` (400, chýba `versionId`).                                                                                                                                                                                                |

## Backend

| Súbor                                       | Zmena                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/projectVersions.ts`                    | `resolveVersion(tx, { projectId, versionId, role })`: 400 bez verzie, 404 cudzia, 409 uzamknutá/mimo okna pre ne-`ADMIN`; `findPreviousVersion(tx, version)`; `findCurrentVersionId` zostáva.                                                                                                                                                  |
| `services/imports.service.ts`               | Náhľad s porovnaním oproti verzii a predchodcovi; import podľa rozhodnutia 3 v jednej transakcii (`createMany` kópií kľúčov a buniek cez `INSERT … SELECT`, prepis zo súboru, `deleteMany` chýbajúcich), `importedAt`, `IMPORT` udalosť s verziou. Upozornenia na premenné sa prepočítajú pre verziu.                                        |
| `services/translations.service.ts`          | Zoznam za verziu; `diff` cez `LEFT JOIN` predchodcu (raw SQL ako dnešné zoznamy); úprava bunky a kľúča bez `versionId` (verzia z kľúča), Pridať kľúč do verzie; `stats`/`namespaces`/`editors` za verziu.                                                                                                                                     |
| `services/exports.service.ts`               | Export verzie, `diffOnly` filtruje tú istú množinu ako diff; kontrola pred exportom tiež.                                                                                                                                                                                                                                                       |
| `services/projectVersions.service.ts`       | `keyCount` a `importedAt` v zozname; `deleteProjectVersion` (rozhodnutie 10); `getVersionDiffSummary`.                                                                                                                                                                                                                                          |
| `services/dashboard.service.ts`, `activity` | Za verziu (rozhodnutie 11).                                                                                                                                                                                                                                                                                                                     |
| `routes`, `controllers`                     | `DELETE …/versions/:id`, `GET …/versions/:id/diff`; `versionId` v query/tele podľa kontraktov.                                                                                                                                                                                                                                                  |
| `prisma/seed.ts`, `seed.service.ts`         | Každý demo projekt: verzia „v2.44“ (uzamknutá, minulé okno) a „v2.45“ (aktuálna) s importom, aby bol diff vidieť.                                                                                                                                                                                                                              |
| Integračné testy                            | Import s kópiou z predchodcu, opakovaný import maže kľúče, diff (pridané/zmenené/odstránené), export `diffOnly`, mazanie verzie (409 aktuálna), zámok mimo okna, Pridať kľúč do prázdnej verzie 409.                                                                                                                                             |

## Frontend

| Súbor                                           | Zmena                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `routes/projectTranslationsRoute.ts`            | `version` zostáva uuid (bez `ALL`); chýbajúca = aktuálna, inak najnovšia; `diff: z.literal(true)` pre „Zobraziť len zmeny“.                                                                                                                                                                                                              |
| `pages/TranslationsPage`                        | Verzia povinná (select bez krížika, ako dnes); prázdny stav verzie bez importu; prázdny stav projektu bez verzií (Vytvoriť verziu); „Zobraziť len zmeny“ prepínač vedľa Len preklady; zmenené bunky zvýraznené (ľavý okraj / odznak **Nové** pri pridanom kľúči, **Zmenené** pri bunke); dnešný dopyt počtu nepreložených zostáva. |
| `TranslationsVersionBanner`                     | Odpočet + nepreložené + súhrn diffu („Oproti v2.44: 100 nových, 12 zmenených, 3 odstránené kľúče“) z `GET …/versions/:id/diff`; bez tlačidla Zrušiť filter.                                                                                                                                                                              |
| `ImportModal`                                   | Verzia povinná (bez „Bez verzie“), krok kontroly ukáže „prevzaté z v2.44: N kľúčov“ a varovanie „odstráni N kľúčov verzie“ so zoznamom prvých názvov.                                                                                                                                                                                     |
| `ExportModal`                                   | Checkbox **Len zmeny oproti predchádzajúcej verzii** (`diffOnly`), inak celý súbor verzie.                                                                                                                                                                                                                                                 |
| `VersionsTable`, `ProjectVersionsPage`          | Stĺpec **Kľúče** (`keyCount`, „bez importu“), akcia **Zmazať** (`ADMIN`, nie aktuálna) s potvrdením `DeleteVersionModal`.                                                                                                                                                                                                                  |
| `CreateKeyModal`, `EditKeyModal`                | `versionId` povinné; tlačidlo Pridať kľúč skryté pri verzii bez importu.                                                                                                                                                                                                                                                                   |
| `pages/DashboardPage`                           | Select verzie v hlavičke (predvolene aktuálna), dopyty s `versionId`.                                                                                                                                                                                                                                                                      |
| i18n `sk`, `en`, `cs`                           | Nové texty diffu, prázdnych stavov, mazania verzie, chybové kódy.                                                                                                                                                                                                                                                                          |

## E2E a docs

- `versions.spec.ts`: prázdna verzia, import kópiou z predchodcu, diff v zozname a v banneri, opakovaný import s odstránením kľúčov, mazanie verzie, zámok mimo okna pre editora.
- `translations.spec.ts`, `import.spec.ts`, `export.spec.ts`, `dashboard.spec.ts`, `accessibility.spec.ts`: fixtures s verziou, `diffOnly` export, „Zobraziť len zmeny“.
- Docs: `docs/api/project-versions.md`, `translations.md`, `imports.md`, `exports.md`, `dashboard.md`, `docs/database.md`, `docs/frontend.md`, `docs/decisions/0007-version-snapshots.md` (nahrádza 0006), `docs/changelog.md`, `AGENTS.md` (doména Verzia, Import, Translation key).

## Míľniky

Stav 2026-10-22: míľniky A až F sú hotové na vetve `feature/version-snapshots` (po jednom commite na míľnik); otvorené otázky 1 a 2 boli rozhodnuté „áno“ (zmena popisu alebo plurálu je zmena kľúča, prázdny predchodca = všetko pridané).

| #   | Obsah                                                                                                                                                                                           | Overenie                                                                                                                            |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| A   | Migrácia `version_snapshots`, kontrakty, `resolveVersion` + zámok mimo okna, zoznam prekladov za verziu, úprava bunky/kľúča bez `versionId`, seed s dvoma verziami, ADR 0007, docs DB a API      | `pnpm verify`; `pnpm db:reset`; api-smoke `GET …/translations?versionId=` (400 bez verzie, 404 cudzia), úprava bunky ako `EDITOR` v uzamknutej 409 |
| B   | Import s kópiou z predchodcu a definíciou množiny kľúčov, náhľad s `removed`/`copiedFromPrevious`, `importedAt`, Pridať kľúč do prázdnej verzie 409, export verzie + `diffOnly`, integračné testy | `pnpm verify`; api-smoke import `import-sample.csv` do v2.45 → kópia + nové kľúče, druhý import s menším súborom → odstránené       |
| C   | Diff: `?diff=true` v zozname, `GET …/versions/:id/diff`, `DELETE …/versions/:id`, dashboard a aktivita za verziu, integračné testy, docs API                                                    | `pnpm verify`; api-smoke diff v2.45 vs v2.44, zmazanie v2.44 (200), aktuálnej (409)                                                 |
| D   | FE: stránka Preklady za verziu (prázdne stavy, prepínač Zobraziť len zmeny, zvýraznenie, banner s diffom), import a export modály, Pridať kľúč, unit testy, docs frontend                       | `pnpm verify`; v `pnpm dev` celý tok: vytvoriť v2.46, import, diff, export                                                          |
| E   | FE: stránka Verzie (Kľúče, Zmazať), Prehľad za verziu, i18n, unit testy                                                                                                                          | `pnpm verify`; v `pnpm dev` mazanie verzie, prehľad s výberom verzie                                                                 |
| F   | E2E (`versions.spec.ts` a úpravy ostatných), changelog, `AGENTS.md`                                                                                                                             | `pnpm test:e2e`                                                                                                                     |

## Otvorené otázky

1. Má „Zobraziť len zmeny“ zahŕňať aj kľúče, ktorým sa zmenil len popis alebo plurálová premenná (nie hodnoty)? Navrhujem áno, ako „zmenený kľúč“ bez zvýraznenej bunky.
2. Má diff porovnávať aj kľúče verzie, ktorá nemá predchodcu importovaného (predchodca prázdny)? Navrhujem brať prázdneho predchodcu ako „bez kľúčov“: všetko je pridané.

## Nadväzujúce (mimo tohto plánu)

- **Porovnanie dvoch verzií** pre `ADMIN`: zmeny v nižšej verzii po `importedAt` vyššej (bunky s `updatedAt > importedAt`), prípadne ich prenos jedným klikom. Počíta sa s ním, preto `importedAt` vzniká už teraz.
- **História buniek v rámci verzie** a vrátenie importu: samostatný plán, kópie verzií dávajú históriu len medzi verziami.
