---
title: 'API: jazyky projektu'
updated: 2026-10-20
notion_page_id:
---

# Jazyky projektu (`/api/projects/:projectId/languages`)

Jazyky, do ktorých sa projekt prekladá. Pridať sa dá iba jazyk z pevného katalógu `SUPPORTED_LANGUAGES` (9 jazykov); anglický a pôvodný názov a vlajku dopĺňa backend z katalógu a nedajú sa upraviť. Schémy sú v `packages/shared/src/languages.ts`. Do 2026-10-18 boli jazyky globálne na `/api/languages` a `/api/admin/languages`, tie cesty už neexistujú (404).

| Metóda   | Cesta                                            | Prístup            | Popis                                    |
| -------- | ------------------------------------------------ | ------------------ | ---------------------------------------- |
| `GET`    | `/api/projects/:projectId/languages`             | člen alebo `ADMIN` | jazyky projektu, základný prvý           |
| `POST`   | `/api/projects/:projectId/languages`             | člen alebo `ADMIN` | pridá jazyk z katalógu                   |
| `PUT`    | `/api/projects/:projectId/languages/order`       | člen alebo `ADMIN` | nové poradie, prvý jazyk je základný     |
| `DELETE` | `/api/projects/:projectId/languages/:languageId` | člen alebo `ADMIN` | odoberie jazyk z projektu (nie základný) |

Prístup rieši `requireProjectAccess` rovnako ako ostatné cesty projektu: bez session 401 `AUTH_UNAUTHENTICATED`, mimo prístupu 404 `NOT_FOUND` (viď [projekty](./projects.md#prístup-k-projektu)). Zápisy potrebujú CSRF hlavičku a JSON telo, aj `DELETE` (stačí `{}`), inak 403 `CSRF_REJECTED` (viď [auth](./auth.md#csrf)). Jazyky sa vyberajú aj pri vytvorení projektu (`languageTags` v `POST /api/projects`).

## Základný jazyk

- Každý projekt má najviac jeden základný jazyk (`isBase: true`), stráži to čiastočný unikátny index (viď [Databáza](../database.md#projectlanguage)).
- Prvý jazyk projektu sa automaticky stane základným (pri vytvorení projektu prvý z `languageTags`).
- Mení sa v nastaveniach projektu (`baseLanguageId` v `PATCH /api/projects/:projectId/settings`) alebo presunutím jazyka na prvé miesto (`PUT …/languages/order`), môže to každý člen aj `ADMIN`. Obe cesty menia ten istý príznak `isBase`.
- Základný jazyk sa nedá odobrať (409 `LANGUAGE_IS_BASE`), najprv treba nastaviť iný.
- Pridanie, odobratie, zmena poradia a zmena základného jazyka zamknú riadok projektu, takže dva súbežné prvé `POST` vytvoria práve jeden základný jazyk a `DELETE` nevráti 204, ak sa jazyk medzitým stal základným.

## Odpoveď `Language`

Schéma `languageSchema`.

| Pole          | Typ               | Popis                                                      |
| ------------- | ----------------- | ---------------------------------------------------------- |
| `id`          | UUID              | ID jazyka v projekte                                       |
| `tag`         | string            | tag z katalógu (`sk`, `en`, `de-AT`, ...)                  |
| `englishName` | string            | anglický názov z katalógu                                  |
| `nativeName`  | string            | pôvodný názov z katalógu                                   |
| `flagCode`    | string            | ISO 3166-1 kód krajiny malými písmenami (`sk`, `gb`, `at`) |
| `isBase`      | boolean           | základný jazyk projektu                                    |
| `createdAt`   | string (ISO 8601) | čas pridania do projektu                                   |

## Položka zoznamu `LanguageListItem`

`GET` aj `PUT …/order` vracajú `Language` rozšírený o stav prekladu (schéma `languageListItemSchema`); `POST` vracia len `Language`.

| Pole              | Typ    | Popis                                                                                    |
| ----------------- | ------ | ---------------------------------------------------------------------------------------- |
| `translatedCount` | number | počet kľúčov projektu s hodnotou v tomto jazyku (`null` sa nepočíta)                     |
| `keyCount`        | number | počet kľúčov projektu, v každej položke rovnaký; jazyk je celý preložený, keď sa rovnajú |

Počty rátajú dva agregačné dotazy (`count` kľúčov a `GROUP BY languageId`), riadky prekladov sa nenačítavajú.

## GET /api/projects/:projectId/languages

Vráti `200` s poľom `LanguageListItem[]` (schéma `languagesResponseSchema`, bez obálky), základný jazyk prvý, ostatné podľa poradia (`position`, pri zhode podľa `tag`). V tomto poradí sú aj stĺpce jazykov na stránke Preklady a vlajky v zozname projektov. Projekt bez jazykov vráti `[]`. Nový jazyk (`POST`) sa zaradí na koniec.

## PUT /api/projects/:projectId/languages/order

Telo (schéma `reorderLanguagesRequestSchema`): `{ "languageIds": ["<id>", "<id>", …] }`, všetky jazyky projektu v novom poradí, každý práve raz. Poradie je spoločné pre celý projekt (nie per používateľ). Prvý jazyk sa v tej istej transakcii stane základným, ak ním ešte nie je.

| HTTP | `code`             | Kedy                                                                                                                                                   |
| ---- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 200  |                    | telo `LanguageListItem[]` v novom poradí                                                                                                               |
| 400  | `VALIDATION_ERROR` | prázdny zoznam, duplicitné alebo neplatné ID; zoznam sa nezhoduje s jazykmi projektu, napr. iný člen medzitým jazyk pridal (`languageIds` / `INVALID`) |

Pri chybe sa nič nezapíše.

## POST /api/projects/:projectId/languages

Telo (schéma `createLanguageRequestSchema`): `{ "tag": "ru" }`. Ostatné polia sa ignorujú.

| HTTP | `code`             | Kedy                                              |
| ---- | ------------------ | ------------------------------------------------- |
| 201  |                    | telo `Language`                                   |
| 400  | `VALIDATION_ERROR` | tag mimo katalógu alebo chýba (`tag` / `INVALID`) |
| 409  | `LANGUAGE_TAKEN`   | jazyk už v projekte je                            |

## DELETE /api/projects/:projectId/languages/:languageId

| HTTP | `code`             | Kedy                                                                  |
| ---- | ------------------ | --------------------------------------------------------------------- |
| 204  |                    | jazyk odobraný                                                        |
| 404  | `NOT_FOUND`        | jazyk neexistuje, patrí inému projektu alebo `languageId` nie je UUID |
| 409  | `LANGUAGE_IS_BASE` | ide o základný jazyk projektu                                         |

Odobratím jazyka sa zmažú aj všetky jeho preklady (`Translation`, cascade). Kľúče ostanú.

## Príklad (curl)

```bash
curl -i -b cookies.txt http://localhost:8080/api/projects/<id projektu>/languages
curl -i -b cookies.txt -X POST http://localhost:8080/api/projects/<id projektu>/languages \
  -H 'Content-Type: application/json' -H 'X-Requested-With: XMLHttpRequest' \
  -d '{"tag":"ru"}'
curl -i -b cookies.txt -X PUT http://localhost:8080/api/projects/<id projektu>/languages/order \
  -H 'Content-Type: application/json' -H 'X-Requested-With: XMLHttpRequest' \
  -d '{"languageIds":["<id en>","<id sk>"]}'
```
