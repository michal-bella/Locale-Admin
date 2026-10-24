---
title: 'API: prehľad projektu a aktivita'
updated: 2026-10-24
notion_page_id:
---

# Prehľad projektu a aktivita

Čítacie endpointy pre stránku Prehľad (plán `docs/plans/project-dashboard.md`). Schémy sú v `packages/shared/src/dashboard.ts` a `packages/shared/src/activity.ts`. Jazyky s počtom preložených kľúčov a členov stránka berie z [jazykov projektu](./project-languages.md#položka-zoznamu-languagelistitem) a [členov projektu](./projects.md), tento endpoint ich neopakuje.

| Metóda | Cesta                                     | Prístup            | Popis                                                 |
| ------ | ----------------------------------------- | ------------------ | ----------------------------------------------------- |
| `GET`  | `/api/projects/:projectId/dashboard`      | člen alebo `ADMIN` | štatistiky kľúčov a prekladov                         |
| `GET`  | `/api/projects/:projectId/activity`       | člen alebo `ADMIN` | udalosti, najnovšie prvé, filtre a číslované stránky  |
| `GET`  | `/api/projects/:projectId/activity/daily` | člen alebo `ADMIN` | denné súčty zmien za obdobie a najaktívnejší členovia |

Prístup rieši `requireProjectAccess` ako pri ostatných cestách projektu: bez session 401 `AUTH_UNAUTHENTICATED`, mimo prístupu 404 `NOT_FOUND` (viď [projekty](./projects.md#prístup-k-projektu)). Všetky tri sú iba na čítanie a rátajú sa agregačnými SQL dotazmi, riadky prekladov sa do pamäte nenačítavajú.

## GET /api/projects/:projectId/dashboard

Query (schéma `dashboardQuerySchema`): `versionId` (voliteľné) – verzia, ktorej čísla sa vrátia; bez neho predvolená verzia projektu (aktuálna podľa dátumu, inak najnovšia podľa `startsAt`). Cudzia verzia 404 `PROJECT_VERSION_NOT_FOUND`. Každá verzia má vlastnú kópiu kľúčov, preto prehľad vždy počíta jednu verziu.

Vráti `200` (schéma `dashboardResponseSchema`):

```json
{
	"version": { "id": "…", "name": "v2.45" },
	"keys": { "total": 248, "createdLast30Days": 12 },
	"translatedKeys": 221,
	"strings": { "filled": 1950, "total": 2232 },
	"baseWords": 1830
}
```

| Pole                     | Popis                                                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `version`                | `{ id, name }` počítanej verzie; `null` v projekte bez verzií (potom sú všetky počty 0)                             |
| `keys.total`             | počet kľúčov verzie                                                                                                 |
| `keys.createdLast30Days` | kľúče s `createdAt` za posledných 30 dní (30 × 24 h dozadu od teraz)                                                |
| `translatedKeys`         | kľúče s hodnotou v **každom** jazyku projektu (rovnako ako stav riadku v rozšírenom zobrazení); bez jazykov 0       |
| `strings.total`          | počet buniek: kľúče × jazyky                                                                                        |
| `strings.filled`         | bunky s hodnotou (`null` alebo chýbajúci riadok sa nepočíta)                                                        |
| `baseWords`              | počet slov v hodnotách základného jazyka (úseky bez medzier, `regexp_count(value, '\S+')`); bez základného jazyka 0 |

Projekt bez verzií aj prázdna verzia vrátia samé nuly. Nový jazyk bez prekladov zvýši `strings.total` a `translatedKeys` klesne na 0, kým sa kľúče do neho nepreložia.

## GET /api/projects/:projectId/activity

Každá udalosť nesie `version` (`{ id, name }` verzie, ku ktorej patrí: kľúče, bunky, import, samotná verzia), `null` pri udalostiach projektu (jazyky, členovia, nastavenia) a po zmazaní verzie. Bez filtrov je zoznam za celý projekt. Používa ho Posledná aktivita na Prehľade (prvých 10) aj stránka História.

Query (schéma `activityListQuerySchema`), filtre sa kombinujú:

| Parameter   | Typ                 | Predvolene | Popis                                                                                                                 |
| ----------- | ------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------- |
| `userId`    | UUID                | –          | iba zmeny tohto používateľa                                                                                           |
| `category`  | `ACTIVITY_CATEGORY` | –          | `TRANSLATION`, `IMPORT`, `KEY`, `VERSION`, `LANGUAGE`, `MEMBER` alebo `PROJECT` (typy podľa `ACTIVITY_TYPE_CATEGORY`) |
| `versionId` | UUID                | –          | iba udalosti tejto verzie (udalosti projektu verziu nemajú)                                                           |
| `from`      | string (ISO 8601)   | –          | `createdAt >= from`; História posiela začiatok lokálneho dňa pred 6, 29 alebo 89 dňami                                |
| `to`        | string (ISO 8601)   | –          | `createdAt < to` (výlučne); História ho zatiaľ neposiela                                                              |
| `page`      | celé ≥ 1            | 1          | číslo stránky                                                                                                         |
| `pageSize`  | celé 1 – 50         | 20         | počet udalostí na stránku                                                                                             |

Vráti `200` (schéma `activityListResponseSchema`) `{ items, total, page, pageSize, users }`. Udalosti sú zoradené od najnovšej (`createdAt DESC, id DESC`), stránky cez `OFFSET`. `total` je počet udalostí podľa filtrov; stránka za poslednou má prázdne `items`. Udalosť zapísaná, kým používateľ prechádza stránky, posunie riadky o jeden (cena za čísla stránok a súčet, ktoré kurzor nedá). `users` sú všetci používatelia s udalosťou v projekte bez ohľadu na filtre (bez odstránených), zoradení podľa mena: možnosti filtra osoby.

Položka `ActivityEvent` (schéma `activityEventSchema`):

| Pole        | Typ                         | Popis                                                                                                                  |
| ----------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `id`        | UUID                        | ID udalosti                                                                                                            |
| `createdAt` | string (ISO 8601)           | čas zmeny                                                                                                              |
| `count`     | number                      | počet zmenených prekladov (import = zapísané bunky, úprava = 1)                                                        |
| `user`      | `{ id, name }` alebo `null` | kto zmenu urobil; `name` je celé meno, inak e-mail; `null` po odstránení používateľa (snímka člena v `payload` ostáva) |
| `type`      | `ACTIVITY_TYPE`             | typ udalosti (viď [Databáza](../database.md#activityevent))                                                            |
| `payload`   | objekt podľa `type`         | snímka údajov v čase zmeny (schéma `activityEventDataSchema`), napr. `{ "tag": "en" }` pri `LANGUAGE_ADDED`            |

| HTTP | `code`             | Kedy                                                                                                                                                    |
| ---- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 400  | `VALIDATION_ERROR` | `pageSize` mimo 1 – 50, `page` < 1; `userId` alebo `versionId` nie je UUID, neznáma `category`, `from` / `to` nie je ISO 8601 dátum s časom (`INVALID`) |

## GET /api/projects/:projectId/activity/daily

Query (schéma `activityDailyQuerySchema`):

| Parameter   | Typ                | Predvolene        | Popis                                                                                                                                                                              |
| ----------- | ------------------ | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `versionId` | UUID               | predvolená verzia | verzia, ktorej udalosti sa počítajú (plus udalosti projektu bez verzie: jazyky, členovia, nastavenia); bez neho predvolená verzia projektu, cudzia 404 `PROJECT_VERSION_NOT_FOUND` |
| `range`     | `7d`, `30d`, `90d` | `30d`             | obdobie                                                                                                                                                                            |
| `timeZone`  | IANA zóna          | `UTC`             | zóna, v ktorej sa rátajú kalendárne dni (frontend posiela zónu prehliadača)                                                                                                        |

Zóna sa overuje cez `Intl.DateTimeFormat` (rovnako v prehliadači aj v Node). `Intl.supportedValuesOf('timeZone')` sa nepoužíva, lebo v Node a Chrome neobsahuje `UTC`. Posun (`+01:00`) sa odmieta, PostgreSQL by ho čítal ako POSIX zónu s opačným znamienkom.

Vráti `200` (schéma `activityDailyResponseSchema`):

```json
{
	"days": [
		{ "date": "2026-10-14", "changes": 0 },
		{ "date": "2026-10-15", "changes": 91 }
	],
	"contributors": [{ "user": { "id": "<uuid>", "name": "Jana Nováková" }, "changes": 90 }]
}
```

- `days` má presne 7, 30 alebo 90 položiek, od najstaršej, posledná je dnešok v zóne `timeZone`. Dni bez udalostí majú `changes: 0`.
- `changes` je súčet `count` udalostí dňa (import 90 prekladov = 90), nie počet udalostí.
- Deň udalosti sa určí v zóne: zmena o 23:30 UTC patrí v `Europe/Bratislava` už do nasledujúceho dňa.
- `contributors` je najviac 5 členov s najväčším súčtom `count` za to isté obdobie, pri zhode podľa mena a `id`. Udalosti odstránených používateľov a používatelia so súčtom 0 sa nezapočítavajú.

| HTTP | `code`             | Kedy                                                                  |
| ---- | ------------------ | --------------------------------------------------------------------- |
| 400  | `VALIDATION_ERROR` | neznámy `range` alebo neplatná zóna (`range` / `timeZone`, `INVALID`) |

## Príklad

```bash
curl -s -b cookies.txt 'http://localhost:8080/api/projects/<projectId>/activity?category=IMPORT&page=2&pageSize=20'
curl -s -b cookies.txt 'http://localhost:8080/api/projects/<projectId>/activity/daily?range=7d&timeZone=Europe/Bratislava'
```
