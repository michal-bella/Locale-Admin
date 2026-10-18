---
title: 'API: jazyky'
updated: 2026-10-18
notion_page_id:
---

# Jazyky (`/api/languages`, `/api/admin/languages`)

Správa jazykov, do ktorých sa prekladá. Kým nie sú jazyky naviazané na projekt, je to jeden globálny zoznam. Pridať sa dá iba jazyk z pevného katalógu `SUPPORTED_LANGUAGES` (9 jazykov). Schémy sú v `packages/shared/src/languages.ts`.

| Metóda   | Cesta                      | Prihlásenie | Popis                                        |
| -------- | -------------------------- | ----------- | -------------------------------------------- |
| `GET`    | `/api/languages`           | prihlásený  | zoznam jazykov, základný prvý                |
| `POST`   | `/api/admin/languages`     | `ADMIN`     | pridá jazyk z katalógu                       |
| `PATCH`  | `/api/admin/languages/:id` | `ADMIN`     | upraví názvy, vlajku, nastaví základný jazyk |
| `DELETE` | `/api/admin/languages/:id` | `ADMIN`     | odstráni jazyk (okrem základného)            |

Zoznam (`/api/languages`) je za `requireAuth` a vidí ho každý prihlásený, lebo nastavenia projektu ukazujú základný jazyk aj členom. Zápisy sú pod `/api/admin`, ktorý je celý za `requireAuth` a `requireRole(ROLE.ADMIN)`: bez session vráti 401 `AUTH_UNAUTHENTICATED`, prihlásený `EDITOR` dostane 403 `FORBIDDEN` (viď [auth](./auth.md#oprávnenia)). Zápisy (`POST`, `PATCH`, `DELETE`) potrebujú CSRF hlavičku a JSON telo, aj `DELETE` (stačí `{}`), inak 403 `CSRF_REJECTED` (viď [auth](./auth.md#csrf)).

## Základný jazyk

- V systéme je najviac jeden základný jazyk (`isBase: true`). Stráži to čiastočný unikátny index v databáze (viď [Databáza](../database.md#language)).
- Prvý pridaný jazyk sa automaticky stane základným.
- Základný jazyk sa mení cez `PATCH` s `isBase: true` pri inom jazyku. Starý jazyk stratí príznak v tej istej transakcii. Vypnúť príznak (`isBase: false`) sa nedá.
- Základný jazyk sa nedá odstrániť (409 `LANGUAGE_IS_BASE`). Najprv treba nastaviť iný základný jazyk.
- Vytvorenie jazyka, zmena základného jazyka a odstránenie bežia v transakcii s advisory zámkom (`pg_advisory_xact_lock`), takže súbežné požiadavky sa vykonajú postupne. Dve súbežné prvé `POST` vytvoria práve jeden základný jazyk, súbežný `PATCH` s `isBase: true` nikdy neskončí 500 a `DELETE` nevráti 204, ak sa jazyk medzitým stal základným (vráti 409 `LANGUAGE_IS_BASE`).

## Odpoveď `Language`

Schéma `languageSchema`.

| Pole          | Typ               | Popis                                                      |
| ------------- | ----------------- | ---------------------------------------------------------- |
| `id`          | UUID              | ID jazyka                                                  |
| `tag`         | string            | tag z katalógu (`sk`, `en`, `de-AT`, ...), nedá sa upraviť |
| `englishName` | string            | anglický názov                                             |
| `nativeName`  | string            | pôvodný názov                                              |
| `flagCode`    | string            | ISO 3166-1 kód krajiny malými písmenami (`sk`, `gb`, `at`) |
| `isBase`      | boolean           | základný jazyk                                             |
| `createdAt`   | string (ISO 8601) | čas pridania, napr. `2026-10-17T08:30:00.000Z`             |

```json
{
	"id": "6f1c0f8e-1b7e-4c47-9a53-0a4b1f3e2d11",
	"tag": "sk",
	"englishName": "Slovak",
	"nativeName": "slovenčina",
	"flagCode": "sk",
	"isBase": true,
	"createdAt": "2026-10-17T08:30:00.000Z"
}
```

## GET /api/languages

Vráti `200` s poľom `Language[]` (schéma `languagesResponseSchema`, bez obálky). Základný jazyk je prvý, ostatné podľa `tag`. Bez jazykov vráti `[]`. Do 2026-10-18 bol zoznam na `GET /api/admin/languages` iba pre `ADMIN`.

| HTTP | `code`                 | Kedy                           |
| ---- | ---------------------- | ------------------------------ |
| 200  |                        | zoznam jazykov                 |
| 401  | `AUTH_UNAUTHENTICATED` | chýba alebo expirovala session |

## POST /api/admin/languages

Telo (schéma `createLanguageRequestSchema`):

```json
{ "tag": "ru" }
```

- `tag` musí byť z katalógu. Anglický a pôvodný názov a vlajku doplní backend z katalógu, ostatné polia v tele sa ignorujú.
- Prvý jazyk dostane `isBase: true`, každý ďalší `false`.
- Tag je unikátny. Duplicitu stráži unikátny index v databáze, takže 409 vráti aj pri dvoch súbežných požiadavkách s rovnakým tagom.

| HTTP | `code`                 | Kedy                                  |
| ---- | ---------------------- | ------------------------------------- |
| 201  |                        | jazyk pridaný, telo `Language`        |
| 400  | `VALIDATION_ERROR`     | chýbajúci tag alebo tag mimo katalógu |
| 401  | `AUTH_UNAUTHENTICATED` | chýba alebo expirovala session        |
| 403  | `FORBIDDEN`            | prihlásený používateľ nie je `ADMIN`  |
| 403  | `CSRF_REJECTED`        | chýba CSRF hlavička alebo JSON telo   |
| 409  | `LANGUAGE_TAKEN`       | jazyk s týmto tagom už existuje       |

Chýbajúci aj neznámy tag dáva `details: [{ "path": "tag", "code": "INVALID" }]` (zod pri enume nerozlišuje chýbajúcu hodnotu).

## PATCH /api/admin/languages/:id

Telo (schéma `updateLanguageRequestSchema`):

```json
{ "englishName": "Russian", "nativeName": "русский", "flagCode": "ru", "isBase": true }
```

- `englishName` a `nativeName` sa upravia cez `trim()` a musia mať 1 až 100 znakov (`LANGUAGE_NAME_MAX_LENGTH`).
- `flagCode` musí byť jedna z vlajok katalógu (`LANGUAGE_FLAG_CODES`).
- `isBase` je nepovinné a smie byť iba `true`: jazyk sa stane základným a doterajší základný jazyk príznak stratí (jedna transakcia). Bez `isBase` sa príznak nemení.
- `tag` v tele sa ignoruje, tag sa nedá zmeniť.

| HTTP | `code`                 | Kedy                                                 |
| ---- | ---------------------- | ---------------------------------------------------- |
| 200  |                        | jazyk uložený, telo `Language`                       |
| 400  | `VALIDATION_ERROR`     | nevalidné telo, `details` podľa polí (viď nižšie)    |
| 401  | `AUTH_UNAUTHENTICATED` | chýba alebo expirovala session                       |
| 403  | `FORBIDDEN`            | prihlásený používateľ nie je `ADMIN`                 |
| 403  | `CSRF_REJECTED`        | chýba CSRF hlavička alebo JSON telo                  |
| 404  | `NOT_FOUND`            | jazyk s týmto `id` neexistuje alebo `id` nie je UUID |

Príklady `details` pri 400:

| Situácia                       | `details`                                                                  |
| ------------------------------ | -------------------------------------------------------------------------- |
| prázdny názov (aj iba medzery) | `[{ "path": "englishName", "code": "REQUIRED" }]`                          |
| príliš dlhý názov              | `[{ "path": "nativeName", "code": "TOO_LONG", "params": { "max": 100 } }]` |
| vlajka mimo zoznamu            | `[{ "path": "flagCode", "code": "INVALID" }]`                              |
| `isBase: false`                | `[{ "path": "isBase", "code": "INVALID" }]`                                |

## DELETE /api/admin/languages/:id

Odstráni jazyk a vráti `204` bez tela.

| HTTP | `code`                 | Kedy                                                 |
| ---- | ---------------------- | ---------------------------------------------------- |
| 204  |                        | jazyk odstránený                                     |
| 401  | `AUTH_UNAUTHENTICATED` | chýba alebo expirovala session                       |
| 403  | `FORBIDDEN`            | prihlásený používateľ nie je `ADMIN`                 |
| 403  | `CSRF_REJECTED`        | chýba CSRF hlavička alebo JSON telo                  |
| 404  | `NOT_FOUND`            | jazyk s týmto `id` neexistuje alebo `id` nie je UUID |
| 409  | `LANGUAGE_IS_BASE`     | jazyk je základný                                    |

## Príklad (curl)

```bash
curl -i -c cookies.txt -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' -H 'X-Requested-With: XMLHttpRequest' \
  -d '{"email":"admin@firma.sk","password":"••••••••"}'
curl -i -b cookies.txt http://localhost:8080/api/admin/languages
curl -i -b cookies.txt -X POST http://localhost:8080/api/admin/languages \
  -H 'Content-Type: application/json' -H 'X-Requested-With: XMLHttpRequest' \
  -d '{"tag":"ru"}'
curl -i -b cookies.txt -X PATCH http://localhost:8080/api/admin/languages/<id> \
  -H 'Content-Type: application/json' -H 'X-Requested-With: XMLHttpRequest' \
  -d '{"englishName":"Russian","nativeName":"русский","flagCode":"ru","isBase":true}'
curl -i -b cookies.txt -X DELETE http://localhost:8080/api/admin/languages/<id> \
  -H 'Content-Type: application/json' -H 'X-Requested-With: XMLHttpRequest' -d '{}'
```
