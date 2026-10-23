---
title: 'Banner upozornení na premenné – implementačný plán'
updated: 2026-10-21
notion_page_id:
---

# Banner upozornení na premenné

> **Zmena 2026-10-23:** referenciou premenných je pri vetnom kľúči s premennými jeho názov pre všetky jazyky vrátane základného, takže upozornenie dostane základný jazyk, ktorému premenná chýba, a nie preklady, ktoré ju majú. Ostatné kľúče ostávajú pri hodnote základného jazyka. Pravidlo: [API: ochrana premenných](../api/translations.md#ochrana-premenných).

## Kontext

Tabuľka prekladov už ukazuje nezhody premenných oproti základnému jazyku: žltý chip pri premennej, ktorú základný jazyk nemá, a výstražnú ikonu pri chýbajúcej premennej. Vznikajú najmä importom (import ich iba ohlási a zapíše) a pri starších dátach. Editor sa o nich dozvie až keď na riadok natrafí alebo pri exporte (kontrola pred exportom). Tento plán pridáva na stránku Preklady **žltý banner**: „N kľúčov má premenné, ktoré sa líšia od základného jazyka“ a tlačidlo **Zobraziť upozornenia**, ktoré vyfiltruje iba riadky s aspoň jednou nezhodou. Banner nič nevypisuje, zdrojom pravdy ostáva tabuľka.

Postup podľa `.agents/workflows/feature.md` na vetve `feature/translation-warnings`. Po každom míľniku checkpoint (`pnpm verify`, `docs/`, commit, krátky report).

### Požiadavky používateľa

- Banner iba vtedy, keď má aspoň jeden riadok upozornenie.
- Krátky text a tlačidlo, bez zoznamu upozornení.
- Tlačidlo vyfiltruje riadky s aspoň jedným upozornením; tabuľka ich ukáže ako doteraz.

### Rozhodnutia

| #   | Rozhodnutie                                                                                                                                                                                                                 | Prečo                                                                                                                                                                                                   |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Uložený príznak** `Translation.placeholderWarning` namiesto počítania za behu.                                                                                                                                            | Porovnanie (`comparePlaceholders`) je JS, nie SQL. B2B admin má vyše 2 000 kľúčov × 9 jazykov; filter a počet pri každom načítaní stránky by prechádzali desaťtisíce buniek. Príznak je obyčajný SQL. |
| 2   | Príznak je `Boolean?`: `NULL` = ešte nevypočítané (riadky spred migrácie, riadky vložené mimo služieb), `true` = nezhoda, `false` = v poriadku. Seed, ktorý beží pri každom štarte kontajnera, dopočíta `NULL` riadky.     | Migrácia nevie spustiť JS. Dopočítanie v seede je idempotentné a nepotrebuje ručný krok; po prvom behu sú všetky riadky vyplnené, služby ich odvtedy zapisujú vždy.                                   |
| 3   | Referencia a pravidlá sú tie isté ako pri úprave a kontrole pred exportom: hodnota základného jazyka, inak názov kľúča, ak má premenné; bunky základného jazyka majú vždy `false`. Počíta sa bez ohľadu na `protectVariables`. | Jedna pravda pre chip, ikonu, export aj banner. Kontrola pred exportom tiež varuje bez ohľadu na nastavenie projektu.                                                                                 |
| 4   | Prepočet na úrovni **kľúča** (`recomputePlaceholderWarnings(tx, keyIds)`), vždy v transakcii zápisu.                                                                                                                       | Zmena základného jazyka alebo názvu kľúča mení referenciu pre všetky bunky kľúča.                                                                                                                       |
| 5   | Riadok s upozornením = kľúč s aspoň jednou bunkou `placeholderWarning = true`; `stats.warnings` je počet takých kľúčov v projekte (bez ohľadu na filtre, ako ostatné `stats`).                                              | Banner hovorí o kľúčoch, tabuľka má riadky po kľúčoch.                                                                                                                                                 |

## Dátový model (nová migrácia `translation_placeholder_warning`)

```prisma
model Translation {
  …
  /// `true` when the value's placeholders differ from the reference (base value, else a key name with placeholders); `false` when checked
  /// and fine, also for every base-language cell; `null` for rows the services have not computed yet (seed fills them on start).
  placeholderWarning Boolean?
}
```

Bez indexu: filter aj počet idú cez PK (`keyId`, `languageId`) po kľúčoch projektu; pridá sa, ak to meranie ukáže.

## Kde sa príznak prepočítava

| Zápis                                                             | Rozsah prepočtu                              |
| ----------------------------------------------------------------- | -------------------------------------------- |
| `PUT …/keys/:keyId/translations/:languageId`                      | kľúč (základný jazyk mení referenciu)        |
| `POST …/keys`                                                     | nový kľúč                                    |
| `PATCH …/keys/:keyId` (názov alebo plurál)                        | kľúč                                         |
| `POST …/imports`                                                  | vytvorené a zapísané kľúče, po dávkach 5 000 |
| zmena základného jazyka (`PATCH …/settings`, `setBaseLanguage`)   | celý projekt, po dávkach                     |
| seed pri štarte (`seedPlaceholderWarnings`)                       | kľúče, ktoré majú riadok s `NULL`            |

Odobratie jazyka a zmazanie kľúča riešia kaskády (základný jazyk sa odobrať nedá).

## Kontrakt (`packages/shared/src/translations.ts`)

- `translationsQuerySchema`: `warnings` (`'true'` → iba kľúče s upozornením; preprocess ako ostatné filtre, v URL `?warnings=1`).
- `translationsResponseSchema.stats`: `warnings` (počet kľúčov s upozornením v projekte).
- `TranslationsSearch` routy: `warnings?: true`.

## Backend

| Súbor                                      | Zmena                                                                                                                                              |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/placeholderWarnings.ts` (nový)        | `recomputePlaceholderWarnings(tx, keyIds)`, `recomputeProjectPlaceholderWarnings(tx, projectId)`, `seedPlaceholderWarnings(prisma)`; zapisuje iba zmenené riadky (`unnest` + `UPDATE … WHERE IS DISTINCT FROM`). |
| `services/translations.service.ts`         | volania po upserte, po vytvorení kľúča a po úprave kľúča; `stats.warnings`; filter `warnings` (`EXISTS (SELECT 1 FROM "Translation" x WHERE x."keyId" = k.id AND x."placeholderWarning")`). |
| `services/imports.service.ts`              | prepočet zapísaných a vytvorených kľúčov pred `recordActivity`.                                                                                     |
| `services/projectLanguages.service.ts`     | prepočet projektu v `setBaseLanguage`, keď sa základ zmenil.                                                                                        |
| `services/seed.service.ts`, `prisma/seed.ts` | dopočítanie `NULL` riadkov po `seedProject`.                                                                                                      |
| `services/exports.service.ts`              | bez zmeny teraz; kontrola pred exportom môže neskôr čítať príznak namiesto prepočtu (rozhodnúť po meraní).                                          |

## Frontend

| Súbor                                                  | Zmena                                                                                                                                                                   |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `routes/projectTranslationsRoute.ts`                   | `warnings` v `validateSearch`.                                                                                                                                          |
| `pages/TranslationsPage/TranslationsPage.tsx`          | `warnings` do dotazu; banner medzi štatistikami a kartou tabuľky, keď `stats.warnings > 0`: Mantine `Alert` (žltý, ikona `AlertTriangle`), text s počtom (plurál), tlačidlo **Zobraziť upozornenia** (`warnings: true`, `page` reset) a pri zapnutom filtri **Zrušiť filter**. |
| `components/TranslationsToolbar`                       | chip/označenie aktívneho filtra `warnings` a jeho zrušenie cez **Zrušiť filtre** (`clearFilters` ho zahrnie).                                                           |
| `components/TranslationStats`                          | karty bez zmeny (banner je samostatný).                                                                                                                                 |
| i18n `sk`, `en`, `cs`                                  | `translationsPage.warnings.{message_one…, show, clear}`.                                                                                                                |

## E2E a docs

- `translations.spec.ts`: projekt s importom `import-sample.csv` (cs má `PLACEHOLDER_MISMATCH` pri `cart.items`): banner s počtom, klik vyfiltruje riadok, URL `?warnings=1`, Zrušiť filter.
- `docs/api/translations.md` (filter, `stats.warnings`), `docs/database.md` (stĺpec, kedy sa prepočítava), `docs/frontend.md` (banner), `docs/testing.md`, changelog.

## Míľniky

| #   | Obsah                                                                                                                   | Overenie                                                                      |
| --- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| A   | Migrácia, `lib/placeholderWarnings.ts`, prepočet vo všetkých zápisoch, dopočítanie v seede, integračné testy príznaku | `pnpm verify`; `pnpm db:migrate` dopočíta existujúce riadky v dev DB           |
| B   | Kontrakt `warnings` + `stats.warnings`, filter a počet v API, integračné testy, docs API                               | `pnpm verify`; api-smoke `GET …/translations?warnings=true`                   |
| C   | FE banner, filter v URL a toolbare, unit testy, docs frontend                                                           | `pnpm verify`; v `pnpm dev` po importe `import-sample.csv`                     |
| D   | E2E v `translations.spec.ts`, changelog                                                                                 | `pnpm test:e2e tests/translations.spec.ts`                                     |

## Otvorené otázky

1. Má banner vidieť aj Návštevník? (Navrhujem áno, filter je iba čítanie.)
2. Má byť filter aj v selecte Stav (tretia možnosť „S upozornením“), alebo iba tlačidlo v banneri? (Navrhujem iba banner a chip v toolbare, aby Stav ostal o preložené/nepreložené.)
