---
title: 'API: verzie projektu'
updated: 2026-10-22
notion_page_id:
---

# Verzie projektu (`/api/projects/:projectId/versions`)

Verzia prekladov je pomenované časové okno projektu zhodné s verziou aplikácie v kóde (`v2.45`): `startsAt` je deň, dokedy vývojári dodajú kľúče (code freeze), `endsAt` deň, dokedy editori preklady dokončia a vývojári ich syncujú do release vetvy. Verzia sa zapisuje na kľúče a bunky, ktoré v nej vznikli alebo sa zmenili (od míľnika B plánu [`translation-versions`](../plans/translation-versions.md)); dáta sa nekopírujú. Projekt bez verzií funguje ako doteraz. Schémy sú v `packages/shared/src/projectVersions.ts`, rozhodnutie v [ADR 0006](../decisions/0006-project-versions.md).

| Metóda  | Cesta                                          | Prístup            | Popis                                      |
| ------- | ---------------------------------------------- | ------------------ | ------------------------------------------ |
| `GET`   | `/api/projects/:projectId/versions`            | člen alebo `ADMIN` | verzie projektu, najnovší `startsAt` prvý  |
| `POST`  | `/api/projects/:projectId/versions`            | iba `ADMIN`        | vytvorí verziu                             |
| `PATCH` | `/api/projects/:projectId/versions/:versionId` | iba `ADMIN`        | zmení názov, dátumy alebo zamkne / odomkne |

Každá verzia má vlastnú kópiu kľúčov a buniek ([ADR 0007](../decisions/0007-version-snapshots.md)): vzniká prázdna (`importedAt = null`, `keyCount = 0`) a naplní ju import. Import skopíruje kľúče najbližšej staršej verzie podľa `startsAt` (**predchádzajúca verzia**, `findPreviousVersion`) a definuje množinu kľúčov verzie (viď [import](./imports.md#zlúčenie-s-dátami-verzie)); do prázdnej verzie sa kľúč ručne pridať nedá (409 `PROJECT_VERSION_EMPTY`). Zmazanie verzie pribudne v míľniku C plánu `version-snapshots`; chybná verzia sa zatiaľ opraví cez `PATCH`. Prístup rieši `requireProjectAccess` ako ostatné cesty projektu (401 bez session, 404 `NOT_FOUND` mimo prístupu), zápisy potrebujú CSRF hlavičku a JSON telo (viď [auth](./auth.md#csrf)).

## Uzamknutie

Uzamknutá verzia je zdroj pravdy toho, čo je v kóde: `EDITOR` a `VISITOR` do nej nemôžu zapisovať (úprava bunky, nový kľúč, import s touto verziou vrátia 409 `PROJECT_VERSION_LOCKED`), `ADMIN` môže vždy. Uloženie `lock`:

| `lock`     | Význam                                                                                               |
| ---------- | ---------------------------------------------------------------------------------------------------- |
| `AUTO`     | predvolené; pre editora je verzia uzamknutá mimo svojho okna: pred `startsAt` aj odo dňa po `endsAt` |
| `LOCKED`   | `ADMIN` zamkol ručne, aj pred termínom                                                               |
| `UNLOCKED` | `ADMIN` odomkol ručne (dodatočné úpravy po termíne); platí, kým znova nezamkne                       |

Efektívne uzamknutie `isLocked` počíta `isVersionLocked` v `packages/shared`: `lock = LOCKED`, alebo `lock = AUTO` a dnešný dátum servera je mimo okna (pred `startsAt` alebo po `endsAt`). Verzia, do ktorej padá dnešok (`isCurrent`), je teda uzamknutá iba ručne.

## Odpoveď `ProjectVersion`

Schéma `projectVersionSchema`.

| Pole         | Typ                                | Popis                                                                                                                                                                   |
| ------------ | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`         | UUID                               |                                                                                                                                                                         |
| `name`       | string                             | názov zhodný s verziou v kóde, 1 až 50 znakov, unikátny v projekte                                                                                                      |
| `startsAt`   | `YYYY-MM-DD`                       | začiatok okna (code freeze)                                                                                                                                             |
| `endsAt`     | `YYYY-MM-DD`                       | koniec okna (end of copy + translation), vždy po `startsAt`                                                                                                             |
| `lock`       | `AUTO` \| `LOCKED` \| `UNLOCKED`   | uložené nastavenie, viď vyššie                                                                                                                                          |
| `isLocked`   | boolean                            | efektívne uzamknutie pre dnešok                                                                                                                                         |
| `state`      | `UPCOMING` \| `ACTIVE` \| `LOCKED` | `LOCKED` pri ručnom zámku alebo `AUTO` po `endsAt`, `UPCOMING` pred `startsAt` (hoci `isLocked` je pre editora `true`), inak `ACTIVE` (aj odomknutá verzia po `endsAt`) |
| `isCurrent`  | boolean                            | dnešok je medzi `startsAt` a `endsAt` vrátane; pri prekryve je aktuálna verzia s najneskorším `startsAt`                                                                |
| `importedAt` | string (ISO 8601) \| `null`        | čas posledného importu do verzie; `null` = prázdna verzia                                                                                                               |
| `keyCount`   | číslo                              | počet kľúčov verzie                                                                                                                                                     |
| `createdAt`  | string (ISO 8601)                  |                                                                                                                                                                         |
| `createdBy`  | `{ id, name }` \| `null`           | kto verziu vytvoril, `null` po zmazaní používateľa                                                                                                                      |

Dátumy sú kalendárne dni bez času (`DATE` v Postgrese); „dnes“ je dátum servera. Verzie jedného projektu sa môžu prekrývať (sprinty v release pláne sa prekrývajú).

## GET /api/projects/:projectId/versions

Vráti `200` s `{ items: ProjectVersion[] }` (schéma `projectVersionsResponseSchema`), zoradené podľa `startsAt` zostupne, pri zhode novšie prvé. Projekt bez verzií vráti `{ items: [] }`.

## POST /api/projects/:projectId/versions

Telo (schéma `createProjectVersionRequestSchema`): `{ "name": "v2.45", "startsAt": "2026-09-08", "endsAt": "2026-09-29" }`. Názov sa oreže, ostatné polia sa ignorujú. Nová verzia má `lock = AUTO`. Zapíše udalosť `VERSION_CREATED`.

| HTTP | `code`                       | Kedy                                                                                                |
| ---- | ---------------------------- | --------------------------------------------------------------------------------------------------- |
| 201  |                              | telo `ProjectVersion`                                                                               |
| 400  | `VALIDATION_ERROR`           | chýbajúce pole, zlý formát dátumu (`INVALID`), `endsAt` nie je po `startsAt` (`endsAt` / `INVALID`) |
| 403  | `FORBIDDEN`                  | volajúci nie je `ADMIN`                                                                             |
| 409  | `PROJECT_VERSION_NAME_TAKEN` | verzia s týmto názvom v projekte už je                                                              |

## PATCH /api/projects/:projectId/versions/:versionId

Telo (schéma `updateProjectVersionRequestSchema`): ľubovoľná neprázdna podmnožina `{ name, startsAt, endsAt, lock }`, kde `lock` je `LOCKED` alebo `UNLOCKED` (`AUTO` sa nastaviť nedá). Dátumy sa kontrolujú spolu s uloženými: `PATCH { "startsAt": "2026-09-29" }` na verziu s `endsAt = 2026-09-29` vráti 400 na `endsAt`. Kľúče a bunky ostávajú priradené k verzii. Udalosť `VERSION_UPDATED` sa zapíše iba keď sa aspoň jedno pole naozaj zmenilo, s poľom `fields` zmenených atribútov.

| HTTP | `code`                       | Kedy                                                                  |
| ---- | ---------------------------- | --------------------------------------------------------------------- |
| 200  |                              | telo `ProjectVersion` po zmene (aj keď sa nič nezmenilo)              |
| 400  | `VALIDATION_ERROR`           | prázdne telo, `lock: AUTO`, zlý formát, `endsAt` nie je po `startsAt` |
| 403  | `FORBIDDEN`                  | volajúci nie je `ADMIN`                                               |
| 404  | `PROJECT_VERSION_NOT_FOUND`  | verzia nepatrí projektu alebo `versionId` nie je UUID                 |
| 409  | `PROJECT_VERSION_NAME_TAKEN` | nový názov už má iná verzia projektu                                  |

## Verzia pri zápisoch (`resolveVersion`)

Helper `resolveVersion(db, { projectId, versionId, role })` v `backend/src/lib/projectVersions.ts` používa každý zápis (úprava bunky podľa verzie kľúča, Pridať kľúč a import podľa `versionId` v tele): overí, že verzia patrí projektu (404 `PROJECT_VERSION_NOT_FOUND`), a pre inú rolu než `ADMIN`, že nie je uzamknutá (409 `PROJECT_VERSION_LOCKED`). Čítania (zoznam, export) overujú príslušnosť cez `assertProjectVersion`. Žiadny zápis verziu neodhaduje; `findDefaultVersionId` (aktuálna podľa dátumu, inak najnovšia) slúži iba projektovým súhrnom.

## Príklad (curl)

```bash
curl -i -b cookies.txt http://localhost:8080/api/projects/<id projektu>/versions
curl -i -b cookies.txt -X POST http://localhost:8080/api/projects/<id projektu>/versions \
  -H 'Content-Type: application/json' -H 'X-Requested-With: XMLHttpRequest' \
  -d '{"name":"v2.45","startsAt":"2026-09-08","endsAt":"2026-09-29"}'
curl -i -b cookies.txt -X PATCH http://localhost:8080/api/projects/<id projektu>/versions/<id verzie> \
  -H 'Content-Type: application/json' -H 'X-Requested-With: XMLHttpRequest' \
  -d '{"lock":"UNLOCKED"}'
```
