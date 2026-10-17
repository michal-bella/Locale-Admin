---
title: 'API: nastavenia projektu'
updated: 2026-10-17
notion_page_id:
---

# Nastavenia projektu (`/api/admin/project`)

Nastavenia projektu pre obrazovku Nastavenia projektu. Zatiaľ existuje jediný projekt (vytvorí ho seed), preto API nemá `id` v ceste a pracuje s týmto projektom. Keď pribudne viac projektov, API sa presunie na `/api/admin/projects/:id`. Schémy sú v `packages/shared/src/projectSettings.ts`.

| Metóda  | Cesta                | Prihlásenie | Popis                                       |
| ------- | -------------------- | ----------- | ------------------------------------------- |
| `GET`   | `/api/admin/project` | `ADMIN`     | nastavenia projektu                         |
| `PATCH` | `/api/admin/project` | `ADMIN`     | uloží nastavenia projektu aj základný jazyk |

Celý router `/api/admin` je za `requireAuth` a `requireRole(ROLE.ADMIN)`: bez session vráti 401 `AUTH_UNAUTHENTICATED`, prihlásený `EDITOR` dostane 403 `FORBIDDEN` (viď [auth](./auth.md#oprávnenia)). `PATCH` potrebuje CSRF hlavičku a JSON telo, inak 403 `CSRF_REJECTED` (viď [auth](./auth.md#csrf)).

## Základný jazyk

Projekt nemá vlastný základný jazyk. `baseLanguageId` je `id` globálneho jazyka s `isBase: true` zo stránky Jazyky (viď [jazyky](./admin-languages.md#základný-jazyk)). Uloženie iného `baseLanguageId` presunie príznak `isBase` v tej istej transakcii ako uloženie projektu a s tým istým advisory zámkom ako `PATCH /api/admin/languages/:id`. V systéme tak ostane práve jeden základný jazyk.

## Odpoveď `ProjectSettings`

Schéma `projectSettingsSchema`.

| Pole               | Typ             | Popis                                                      |
| ------------------ | --------------- | ---------------------------------------------------------- |
| `id`               | UUID            | ID projektu                                                |
| `name`             | string          | názov projektu                                             |
| `slug`             | string          | slug projektu (malé písmená, číslice, pomlčky)             |
| `primaryColor`     | string          | primárna farba `#RRGGBB` veľkými písmenami                 |
| `protectVariables` | boolean         | chrániť výrazy `{{ variable }}` (zatiaľ sa iba ukladá)     |
| `baseLanguageId`   | UUID alebo null | `id` základného jazyka, `null` keď neexistuje žiadny jazyk |

```json
{
	"id": "0b7c2f4e-5a8d-4c1e-9f3a-2d6e8b1c4a77",
	"name": "B2B Admin",
	"slug": "b2b-admin",
	"primaryColor": "#E83E8C",
	"protectVariables": true,
	"baseLanguageId": "6f1c0f8e-1b7e-4c47-9a53-0a4b1f3e2d11"
}
```

## GET /api/admin/project

| HTTP | `code`                 | Kedy                                   |
| ---- | ---------------------- | -------------------------------------- |
| 200  |                        | telo `ProjectSettings`                 |
| 401  | `AUTH_UNAUTHENTICATED` | chýba alebo expirovala session         |
| 403  | `FORBIDDEN`            | prihlásený používateľ nie je `ADMIN`   |
| 404  | `NOT_FOUND`            | projekt neexistuje (seed ešte nebežal) |

## PATCH /api/admin/project

Telo (schéma `updateProjectSettingsRequestSchema`), všetky polia sú povinné:

```json
{ "name": "B2B Admin", "slug": "b2b-admin", "primaryColor": "#E83E8C", "protectVariables": true, "baseLanguageId": "6f1c0f8e-1b7e-4c47-9a53-0a4b1f3e2d11" }
```

- `name` sa upraví cez `trim()` a musí mať 1 až 100 znakov (`PROJECT_NAME_MAX_LENGTH`).
- `slug` sa upraví cez `trim()`, musí mať 1 až 50 znakov (`PROJECT_SLUG_MAX_LENGTH`) a tvar `^[a-z0-9]+(?:-[a-z0-9]+)*$` (napr. `b2b-admin`).
- `primaryColor` musí mať tvar `#RRGGBB` a uloží sa veľkými písmenami (`#e83e8c` → `#E83E8C`).
- `baseLanguageId` musí byť `id` existujúceho jazyka. Ak je iný ako doterajší základný jazyk, príznak `isBase` sa presunie. Neexistujúci jazyk vráti 400 a neuloží sa nič (ani projekt).

| HTTP | `code`                 | Kedy                                                          |
| ---- | ---------------------- | ------------------------------------------------------------- |
| 200  |                        | nastavenia uložené, telo `ProjectSettings`                    |
| 400  | `VALIDATION_ERROR`     | nevalidné telo alebo neexistujúci jazyk, `details` podľa polí |
| 401  | `AUTH_UNAUTHENTICATED` | chýba alebo expirovala session                                |
| 403  | `FORBIDDEN`            | prihlásený používateľ nie je `ADMIN`                          |
| 403  | `CSRF_REJECTED`        | chýba CSRF hlavička alebo JSON telo                           |
| 404  | `NOT_FOUND`            | projekt neexistuje (seed ešte nebežal)                        |

Príklady `details` pri 400:

| Situácia                                      | `details`                                                            |
| --------------------------------------------- | -------------------------------------------------------------------- |
| prázdny názov (aj iba medzery)                | `[{ "path": "name", "code": "REQUIRED" }]`                           |
| príliš dlhý názov                             | `[{ "path": "name", "code": "TOO_LONG", "params": { "max": 100 } }]` |
| slug s veľkými písmenami, medzerou alebo `--` | `[{ "path": "slug", "code": "INVALID" }]`                            |
| farba `#FFF` alebo `red`                      | `[{ "path": "primaryColor", "code": "INVALID" }]`                    |
| chýbajúce `protectVariables`                  | `[{ "path": "protectVariables", "code": "REQUIRED" }]`               |
| `baseLanguageId` nie je UUID                  | `[{ "path": "baseLanguageId", "code": "INVALID" }]`                  |
| jazyk s `baseLanguageId` neexistuje           | `[{ "path": "baseLanguageId", "code": "INVALID" }]`                  |

## Príklad (curl)

```bash
curl -i -c cookies.txt -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' -H 'X-Requested-With: XMLHttpRequest' \
  -d '{"email":"admin@firma.sk","password":"••••••••"}'
curl -i -b cookies.txt http://localhost:8080/api/admin/project
curl -i -b cookies.txt -X PATCH http://localhost:8080/api/admin/project \
  -H 'Content-Type: application/json' -H 'X-Requested-With: XMLHttpRequest' \
  -d '{"name":"B2B Admin","slug":"b2b-admin","primaryColor":"#E83E8C","protectVariables":true,"baseLanguageId":"<id jazyka>"}'
```
