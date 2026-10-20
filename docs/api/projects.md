---
title: 'API: projekty a členovia'
updated: 2026-10-19
notion_page_id:
---

# Projekty a členovia (`/api/projects`)

Zoznam projektov pre index stránku, vytvorenie a opustenie projektu, nastavenia projektu a jeho členovia. Schémy sú v `packages/shared/src/projects.ts` a `packages/shared/src/projectSettings.ts`.

| Metóda   | Cesta                                      | Prístup            | Popis                                         |
| -------- | ------------------------------------------ | ------------------ | --------------------------------------------- |
| `GET`    | `/api/projects`                            | prihlásený         | projekty používateľa (ADMIN všetky)           |
| `POST`   | `/api/projects`                            | prihlásený         | vytvorí projekt, tvorca sa stane členom       |
| `PUT`    | `/api/projects/order`                      | prihlásený         | uloží vlastné poradie projektov používateľa   |
| `DELETE` | `/api/projects/:projectId/membership`      | člen               | opustí projekt                                |
| `GET`    | `/api/projects/:projectId/settings`        | člen alebo `ADMIN` | nastavenia projektu                           |
| `PATCH`  | `/api/projects/:projectId/settings`        | člen alebo `ADMIN` | uloží nastavenia (základný jazyk iba `ADMIN`) |
| `GET`    | `/api/projects/:projectId/members`         | člen alebo `ADMIN` | členovia projektu                             |
| `POST`   | `/api/projects/:projectId/members`         | člen alebo `ADMIN` | vytvorí nového používateľa `EDITOR` a člena   |
| `DELETE` | `/api/projects/:projectId/members/:userId` | člen alebo `ADMIN` | odoberie člena z projektu, účet ostane        |

Celý router je za `requireAuth`: bez session vráti 401 `AUTH_UNAUTHENTICATED`. Mutácie potrebujú CSRF hlavičku a JSON telo (aj `DELETE` posiela `{}`), inak 403 `CSRF_REJECTED` (viď [auth](./auth.md#csrf)).

## Prístup k projektu

Cesty s `:projectId` sú za `requireProjectAccess` (`middleware/projectAccess.middleware.ts`). Pustí `ADMIN`-a k akémukoľvek projektu a `EDITOR`-a iba k projektu, kde má záznam `ProjectMember`. Inak, aj pri neexistujúcom projekte alebo `projectId`, ktoré nie je UUID, vráti 404 `NOT_FOUND`, aby sa neprezradilo, že projekt existuje. Projektové role zatiaľ nie sú, všetci členovia majú rovnaké práva.

## GET /api/projects

Vráti `200 { projects: ProjectListItem[] }` (schéma `projectListResponseSchema`) vo vlastnom poradí používateľa ([PUT /api/projects/order](#put-apiprojectsorder)); projekty bez pozície (nové, alebo kým používateľ poradie nezmenil) nasledujú za nimi podľa názvu. `ADMIN` dostane všetky projekty, `EDITOR` iba tie, kde je členom.

| Pole              | Typ      | Popis                                                                                                                       |
| ----------------- | -------- | --------------------------------------------------------------------------------------------------------------------------- |
| `id`              | UUID     | ID projektu                                                                                                                 |
| `name`            | string   | názov projektu                                                                                                              |
| `slug`            | string   | slug projektu                                                                                                               |
| `primaryColor`    | string   | primárna farba `#RRGGBB`                                                                                                    |
| `isMember`        | boolean  | či je prihlásený používateľ členom (`false` iba pre `ADMIN`-a)                                                              |
| `languageTags`    | string[] | tagy jazykov projektu, základný jazyk prvý, potom podľa pridania                                                            |
| `keyCount`        | number   | počet kľúčov projektu                                                                                                       |
| `translatedCount` | number   | počet vyplnených hodnôt cez všetky kľúče a jazyky; projekt je celý preložený, keď sa rovná `keyCount × languageTags.length` |

```json
{
	"projects": [
		{
			"id": "0b7c2f4e-5a8d-4c1e-9f3a-2d6e8b1c4a77",
			"name": "B2B Admin",
			"slug": "b2b-admin",
			"primaryColor": "#E83E8C",
			"isMember": true,
			"languageTags": ["sk", "en"],
			"keyCount": 224,
			"translatedCount": 447
		}
	]
}
```

## POST /api/projects

Telo (schéma `createProjectRequestSchema`): `{ "name": "Booking Web", "slug": "booking-web", "languageTags": ["sk", "en"] }`. Validácia `name` a `slug` je rovnaká ako pri nastaveniach. `languageTags` sú tagy z katalógu, aspoň jeden a bez duplicít (`REQUIRED` / `INVALID`); prvý je základný jazyk. Farba a ochrana premenných dostanú defaulty. Projekt, jeho jazyky aj členstvo tvorcu vzniknú naraz.

| HTTP | `code`             | Kedy                                                                            |
| ---- | ------------------ | ------------------------------------------------------------------------------- |
| 201  |                    | telo `ProjectListItem` s `isMember: true`, `keyCount: 0` a `translatedCount: 0` |
| 400  | `VALIDATION_ERROR` | nevalidné telo, `details` podľa polí                                            |
| 409  | `SLUG_TAKEN`       | projekt s týmto slugom už existuje                                              |

## PUT /api/projects/order

Uloží poradie projektov na indexe `/` (drag and drop) iba pre prihláseného používateľa, ostatných sa netýka. Telo (schéma `reorderProjectsRequestSchema`):

```json
{ "projectIds": ["<id projektu>", "<id projektu>"] }
```

`projectIds` sú všetky projekty, ktoré používateľ vidí, v novom poradí: aspoň jedno, najviac `PROJECT_ORDER_MAX` = 1000, bez duplicít. Poradie sa celé nahradí (`ProjectOrder`); projekt, ktorý v zozname chýba, stratí pozíciu a zaradí sa za ostatné podľa názvu. `ADMIN` môže zoradiť aj projekty, kde nie je členom.

| Status | Kód                    | Kedy                                                                       |
| ------ | ---------------------- | -------------------------------------------------------------------------- |
| 204    | –                      | uložené                                                                    |
| 400    | `VALIDATION_ERROR`     | prázdny zoznam, duplicita alebo nie UUID (`details` s cestou `projectIds`) |
| 404    | `NOT_FOUND`            | niektorý projekt neexistuje alebo ho `EDITOR` nevidí; nič sa nezapíše      |
| 401    | `AUTH_UNAUTHENTICATED` | bez session                                                                |
| 403    | `CSRF_REJECTED`        | bez `X-Requested-With`                                                     |

## DELETE /api/projects/:projectId/membership

Zmaže členstvo prihláseného používateľa. Posledný člen projekt opustiť nemôže. Zámok riadku projektu (`SELECT … FOR UPDATE`) zaručí, že ani dvaja poslední členovia naraz neodídu obaja.

| HTTP | `code`        | Kedy                                                         |
| ---- | ------------- | ------------------------------------------------------------ |
| 204  |               | členstvo zmazané                                             |
| 404  | `NOT_FOUND`   | projekt neexistuje alebo používateľ nie je členom (aj ADMIN) |
| 409  | `LAST_MEMBER` | používateľ je posledný člen projektu                         |

## Nastavenia projektu

### Odpoveď `ProjectSettings`

Schéma `projectSettingsSchema`.

| Pole               | Typ             | Popis                                                           |
| ------------------ | --------------- | --------------------------------------------------------------- |
| `id`               | UUID            | ID projektu                                                     |
| `name`             | string          | názov projektu                                                  |
| `slug`             | string          | slug projektu (malé písmená, číslice, pomlčky)                  |
| `primaryColor`     | string          | primárna farba `#RRGGBB` veľkými písmenami                      |
| `protectVariables` | boolean         | chrániť výrazy `{{ variable }}` (zatiaľ sa iba ukladá)          |
| `baseLanguageId`   | UUID alebo null | `id` základného jazyka projektu, `null` keď projekt nemá jazyky |

### Základný jazyk

`baseLanguageId` je `id` jazyka projektu s `isBase: true` (viď [jazyky projektu](./project-languages.md#základný-jazyk)). Meniť ho môže každý člen aj `ADMIN`. Uloženie iného `baseLanguageId` presunie príznak `isBase` v tej istej transakcii ako uloženie projektu, so zámkom riadku projektu.

### GET /api/projects/:projectId/settings

Vráti `200 ProjectSettings`, inak 404 `NOT_FOUND` (viď [Prístup k projektu](#prístup-k-projektu)).

### PATCH /api/projects/:projectId/settings

Telo (schéma `updateProjectSettingsRequestSchema`):

```json
{ "name": "B2B Admin", "slug": "b2b-admin", "primaryColor": "#E83E8C", "protectVariables": true, "baseLanguageId": "6f1c0f8e-1b7e-4c47-9a53-0a4b1f3e2d11" }
```

- `name` sa upraví cez `trim()` a musí mať 1 až 100 znakov (`PROJECT_NAME_MAX_LENGTH`).
- `slug` sa upraví cez `trim()`, musí mať 1 až 50 znakov (`PROJECT_SLUG_MAX_LENGTH`) a tvar `^[a-z0-9]+(?:-[a-z0-9]+)*$` (napr. `b2b-admin`).
- `primaryColor` musí mať tvar `#RRGGBB` a uloží sa veľkými písmenami (`#e83e8c` → `#E83E8C`).
- `baseLanguageId` je voliteľné. Ak chýba, základný jazyk sa nemení. Inak to musí byť `id` jazyka tohto projektu (inak 400 `baseLanguageId` / `INVALID`).

| HTTP | `code`             | Kedy                                                          |
| ---- | ------------------ | ------------------------------------------------------------- |
| 200  |                    | nastavenia uložené, telo `ProjectSettings`                    |
| 400  | `VALIDATION_ERROR` | nevalidné telo alebo neexistujúci jazyk, `details` podľa polí |
| 404  | `NOT_FOUND`        | viď [Prístup k projektu](#prístup-k-projektu)                 |
| 409  | `SLUG_TAKEN`       | slug má iný projekt                                           |

Príklady `details` pri 400:

| Situácia                                                 | `details`                                                            |
| -------------------------------------------------------- | -------------------------------------------------------------------- |
| prázdny názov (aj iba medzery)                           | `[{ "path": "name", "code": "REQUIRED" }]`                           |
| príliš dlhý názov                                        | `[{ "path": "name", "code": "TOO_LONG", "params": { "max": 100 } }]` |
| slug s veľkými písmenami, medzerou alebo `--`            | `[{ "path": "slug", "code": "INVALID" }]`                            |
| farba `#FFF` alebo `red`                                 | `[{ "path": "primaryColor", "code": "INVALID" }]`                    |
| chýbajúce `protectVariables`                             | `[{ "path": "protectVariables", "code": "REQUIRED" }]`               |
| `baseLanguageId` nie je UUID alebo nie je jazyk projektu | `[{ "path": "baseLanguageId", "code": "INVALID" }]`                  |

## Členovia

### GET /api/projects/:projectId/members

Vráti `200 { members: ProjectMember[] }` (schéma `projectMemberListResponseSchema`) zoradené podľa dátumu pridania do projektu od najstaršieho.

| Pole           | Typ                | Popis                                                               |
| -------------- | ------------------ | ------------------------------------------------------------------- |
| `id`           | UUID               | ID používateľa                                                      |
| `email`        | string             | e-mail                                                              |
| `firstName`    | string alebo null  | meno                                                                |
| `lastName`     | string alebo null  | priezvisko                                                          |
| `role`         | `ADMIN` / `EDITOR` | globálna rola používateľa                                           |
| `projectCount` | number             | počet projektov, v ktorých je členom (ako v `GET /api/admin/users`) |
| `createdAt`    | ISO dátum          | kedy sa stal členom projektu                                        |

### POST /api/projects/:projectId/members

Iba `ADMIN` (`requireRole(ROLE.ADMIN)` za kontrolou prístupu k projektu). Telo (schéma `addProjectMemberRequestSchema`): `{ "userId": "<uuid>" }`. Pridá existujúceho používateľa (ktoréhokoľvek z `GET /api/admin/users`) do projektu; jeho účet, rola ani heslo sa nemenia. Nových používateľov zakladá iba `POST /api/admin/users` (viď [správa používateľov](./admin-users.md)).

| HTTP | `code`             | Kedy                                                                                                         |
| ---- | ------------------ | ------------------------------------------------------------------------------------------------------------ |
| 201  |                    | telo `ProjectMember`                                                                                         |
| 400  | `VALIDATION_ERROR` | `userId` chýba (`REQUIRED`) alebo nie je UUID (`INVALID`)                                                    |
| 403  | `FORBIDDEN`        | prihlásený člen projektu, ktorý nie je `ADMIN`                                                               |
| 404  | `NOT_FOUND`        | projekt mimo prístupu (viď [Prístup k projektu](#prístup-k-projektu)) alebo používateľ s `userId` neexistuje |
| 409  | `ALREADY_MEMBER`   | používateľ už je členom projektu                                                                             |

### DELETE /api/projects/:projectId/members/:userId

Iba `ADMIN`. Odoberie člena z projektu (zmaže `ProjectMember`), účet používateľa ostane a môže byť v iných projektoch. Člen projektu vidí zoznam, ale odoberať nemôže, projektové role zatiaľ nie sú. Rovnako ako pri opustení projektu drží zámok riadku projektu a posledného člena odobrať nejde. UI vlastný riadok neponúka, na to je Opustiť projekt.

| HTTP | `code`        | Kedy                                                                       |
| ---- | ------------- | -------------------------------------------------------------------------- |
| 204  |               | člen odobraný                                                              |
| 403  | `FORBIDDEN`   | prihlásený člen projektu, ktorý nie je `ADMIN`                             |
| 404  | `NOT_FOUND`   | projekt mimo prístupu, používateľ nie je členom alebo `userId` nie je UUID |
| 409  | `LAST_MEMBER` | odoberaný je posledný člen projektu                                        |

## Príklad (curl)

```bash
curl -i -c cookies.txt -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' -H 'X-Requested-With: XMLHttpRequest' \
  -d '{"email":"admin@firma.sk","password":"••••••••"}'
curl -i -b cookies.txt http://localhost:8080/api/projects
curl -i -b cookies.txt -X POST http://localhost:8080/api/projects \
  -H 'Content-Type: application/json' -H 'X-Requested-With: XMLHttpRequest' \
  -d '{"name":"Booking Web","slug":"booking-web","languageTags":["sk","en"]}'
curl -i -b cookies.txt -X PUT http://localhost:8080/api/projects/order \
  -H 'Content-Type: application/json' -H 'X-Requested-With: XMLHttpRequest' \
  -d '{"projectIds":["<id projektu>","<id projektu>"]}'
curl -i -b cookies.txt -X POST http://localhost:8080/api/projects/<id projektu>/members \
  -H 'Content-Type: application/json' -H 'X-Requested-With: XMLHttpRequest' \
  -d '{"email":"meno@firma.sk","password":"••••••••"}'
```
