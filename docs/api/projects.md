---
title: 'API: projekty a členovia'
updated: 2026-10-18
notion_page_id:
---

# Projekty a členovia (`/api/projects`)

Zoznam projektov pre index stránku, vytvorenie a opustenie projektu, nastavenia projektu a jeho členovia. Schémy sú v `packages/shared/src/projects.ts` a `packages/shared/src/projectSettings.ts`.

| Metóda   | Cesta                                 | Prístup            | Popis                                         |
| -------- | ------------------------------------- | ------------------ | --------------------------------------------- |
| `GET`    | `/api/projects`                       | prihlásený         | projekty používateľa (ADMIN všetky)           |
| `POST`   | `/api/projects`                       | prihlásený         | vytvorí projekt, tvorca sa stane členom       |
| `DELETE` | `/api/projects/:projectId/membership` | člen               | opustí projekt                                |
| `GET`    | `/api/projects/:projectId/settings`   | člen alebo `ADMIN` | nastavenia projektu                           |
| `PATCH`  | `/api/projects/:projectId/settings`   | člen alebo `ADMIN` | uloží nastavenia (základný jazyk iba `ADMIN`) |
| `GET`    | `/api/projects/:projectId/members`    | člen alebo `ADMIN` | členovia projektu                             |
| `POST`   | `/api/projects/:projectId/members`    | člen alebo `ADMIN` | vytvorí nového používateľa `EDITOR` a člena   |

Celý router je za `requireAuth`: bez session vráti 401 `AUTH_UNAUTHENTICATED`. Mutácie potrebujú CSRF hlavičku a JSON telo (aj `DELETE` posiela `{}`), inak 403 `CSRF_REJECTED` (viď [auth](./auth.md#csrf)).

## Prístup k projektu

Cesty s `:projectId` sú za `requireProjectAccess` (`middleware/projectAccess.middleware.ts`). Pustí `ADMIN`-a k akémukoľvek projektu a `EDITOR`-a iba k projektu, kde má záznam `ProjectMember`. Inak, aj pri neexistujúcom projekte alebo `projectId`, ktoré nie je UUID, vráti 404 `NOT_FOUND`, aby sa neprezradilo, že projekt existuje. Projektové role zatiaľ nie sú, všetci členovia majú rovnaké práva.

## GET /api/projects

Vráti `200 { projects: ProjectListItem[] }` (schéma `projectListResponseSchema`) zoradené podľa názvu. `ADMIN` dostane všetky projekty, `EDITOR` iba tie, kde je členom.

| Pole           | Typ     | Popis                                                          |
| -------------- | ------- | -------------------------------------------------------------- |
| `id`           | UUID    | ID projektu                                                    |
| `name`         | string  | názov projektu                                                 |
| `slug`         | string  | slug projektu                                                  |
| `primaryColor` | string  | primárna farba `#RRGGBB`                                       |
| `isMember`     | boolean | či je prihlásený používateľ členom (`false` iba pre `ADMIN`-a) |

```json
{ "projects": [{ "id": "0b7c2f4e-5a8d-4c1e-9f3a-2d6e8b1c4a77", "name": "B2B Admin", "slug": "b2b-admin", "primaryColor": "#E83E8C", "isMember": true }] }
```

## POST /api/projects

Telo (schéma `createProjectRequestSchema`): `{ "name": "Booking Web", "slug": "booking-web" }`. Validácia `name` a `slug` je rovnaká ako pri nastaveniach. Farba a ochrana premenných dostanú defaulty. Projekt aj členstvo tvorcu vzniknú naraz.

| HTTP | `code`             | Kedy                                      |
| ---- | ------------------ | ----------------------------------------- |
| 201  |                    | telo `ProjectListItem` s `isMember: true` |
| 400  | `VALIDATION_ERROR` | nevalidné telo, `details` podľa polí      |
| 409  | `SLUG_TAKEN`       | projekt s týmto slugom už existuje        |

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

| Pole               | Typ             | Popis                                                      |
| ------------------ | --------------- | ---------------------------------------------------------- |
| `id`               | UUID            | ID projektu                                                |
| `name`             | string          | názov projektu                                             |
| `slug`             | string          | slug projektu (malé písmená, číslice, pomlčky)             |
| `primaryColor`     | string          | primárna farba `#RRGGBB` veľkými písmenami                 |
| `protectVariables` | boolean         | chrániť výrazy `{{ variable }}` (zatiaľ sa iba ukladá)     |
| `baseLanguageId`   | UUID alebo null | `id` základného jazyka, `null` keď neexistuje žiadny jazyk |

### Základný jazyk

Projekt nemá vlastný základný jazyk. `baseLanguageId` je `id` globálneho jazyka s `isBase: true` zo stránky Jazyky (viď [jazyky](./admin-languages.md#základný-jazyk)). Keďže je globálny, meniť ho môže iba `ADMIN`. Uloženie iného `baseLanguageId` presunie príznak `isBase` v tej istej transakcii ako uloženie projektu a s tým istým advisory zámkom ako `PATCH /api/admin/languages/:id`.

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
- `baseLanguageId` je voliteľné. Ak chýba alebo sa rovná aktuálnemu základnému jazyku, nič sa nemení. Inak ho môže poslať iba `ADMIN` (`EDITOR` dostane 403) a musí to byť `id` existujúceho jazyka.

| HTTP | `code`             | Kedy                                                          |
| ---- | ------------------ | ------------------------------------------------------------- |
| 200  |                    | nastavenia uložené, telo `ProjectSettings`                    |
| 400  | `VALIDATION_ERROR` | nevalidné telo alebo neexistujúci jazyk, `details` podľa polí |
| 403  | `FORBIDDEN`        | `EDITOR` mení základný jazyk, neuloží sa nič                  |
| 404  | `NOT_FOUND`        | viď [Prístup k projektu](#prístup-k-projektu)                 |
| 409  | `SLUG_TAKEN`       | slug má iný projekt                                           |

Príklady `details` pri 400:

| Situácia                                      | `details`                                                            |
| --------------------------------------------- | -------------------------------------------------------------------- |
| prázdny názov (aj iba medzery)                | `[{ "path": "name", "code": "REQUIRED" }]`                           |
| príliš dlhý názov                             | `[{ "path": "name", "code": "TOO_LONG", "params": { "max": 100 } }]` |
| slug s veľkými písmenami, medzerou alebo `--` | `[{ "path": "slug", "code": "INVALID" }]`                            |
| farba `#FFF` alebo `red`                      | `[{ "path": "primaryColor", "code": "INVALID" }]`                    |
| chýbajúce `protectVariables`                  | `[{ "path": "protectVariables", "code": "REQUIRED" }]`               |
| `baseLanguageId` nie je UUID alebo neexistuje | `[{ "path": "baseLanguageId", "code": "INVALID" }]`                  |

## Členovia

### GET /api/projects/:projectId/members

Vráti `200 { members: ProjectMember[] }` (schéma `projectMemberListResponseSchema`) zoradené podľa dátumu pridania do projektu od najstaršieho.

| Pole        | Typ               | Popis                        |
| ----------- | ----------------- | ---------------------------- |
| `id`        | UUID              | ID používateľa               |
| `email`     | string            | e-mail                       |
| `firstName` | string alebo null | meno                         |
| `lastName`  | string alebo null | priezvisko                   |
| `createdAt` | ISO dátum         | kedy sa stal členom projektu |

### POST /api/projects/:projectId/members

Telo (schéma `createProjectMemberRequestSchema`, rovnaká validácia ako `POST /api/admin/users`): `{ "email": "meno@firma.sk", "password": "••••••••" }`. Vytvorí nového používateľa s rolou `EDITOR` a v tej istej operácii ho pridá do projektu. Pridanie existujúceho používateľa do ďalšieho projektu zatiaľ nie je.

| HTTP | `code`             | Kedy                                          |
| ---- | ------------------ | --------------------------------------------- |
| 201  |                    | telo `ProjectMember`                          |
| 400  | `VALIDATION_ERROR` | nevalidný e-mail alebo krátke heslo           |
| 404  | `NOT_FOUND`        | viď [Prístup k projektu](#prístup-k-projektu) |
| 409  | `EMAIL_TAKEN`      | používateľ s týmto e-mailom existuje          |

## Príklad (curl)

```bash
curl -i -c cookies.txt -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' -H 'X-Requested-With: XMLHttpRequest' \
  -d '{"email":"admin@firma.sk","password":"••••••••"}'
curl -i -b cookies.txt http://localhost:8080/api/projects
curl -i -b cookies.txt -X POST http://localhost:8080/api/projects \
  -H 'Content-Type: application/json' -H 'X-Requested-With: XMLHttpRequest' \
  -d '{"name":"Booking Web","slug":"booking-web"}'
curl -i -b cookies.txt -X POST http://localhost:8080/api/projects/<id projektu>/members \
  -H 'Content-Type: application/json' -H 'X-Requested-With: XMLHttpRequest' \
  -d '{"email":"meno@firma.sk","password":"••••••••"}'
```
