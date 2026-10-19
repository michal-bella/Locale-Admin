---
title: 'API: správa projektov'
updated: 2026-10-18
notion_page_id:
---

# Správa projektov (`/api/admin/projects`)

Správcovský pohľad na všetky projekty: zoznam s počtami a zmazanie projektu. Vytvorenie a úprava projektu idú cez existujúce endpointy `POST /api/projects` a `PATCH /api/projects/:projectId/settings` (viď [projekty](./projects.md)). Schémy sú v `packages/shared/src/adminProjects.ts`.

| Metóda   | Cesta                            | Prihlásenie | Popis                                     |
| -------- | -------------------------------- | ----------- | ----------------------------------------- |
| `GET`    | `/api/admin/projects`            | `ADMIN`     | všetky projekty s počtami, podľa názvu    |
| `DELETE` | `/api/admin/projects/:projectId` | `ADMIN`     | zmaže projekt s jeho členstvami a jazykmi |

Celý router `/api/admin` je za `requireAuth` a `requireRole(ROLE.ADMIN)`: bez session vráti 401 `AUTH_UNAUTHENTICATED`, prihlásený `EDITOR` dostane 403 `FORBIDDEN`, aj keď je členom projektu (viď [auth](./auth.md#oprávnenia)).

## Odpoveď `AdminProjectListItem`

Schéma `adminProjectListItemSchema`.

| Pole              | Typ                 | Popis                                                                  |
| ----------------- | ------------------- | ---------------------------------------------------------------------- |
| `id`              | UUID                | ID projektu                                                            |
| `name`            | string              | názov projektu                                                         |
| `slug`            | string              | unikátny slug                                                          |
| `primaryColor`    | string              | primárna farba `#RRGGBB`                                               |
| `baseLanguageTag` | string alebo `null` | tag základného jazyka (napr. `sk`), `null` iba pre projekt bez jazykov |
| `languageCount`   | číslo               | počet jazykov projektu                                                 |
| `memberCount`     | číslo               | počet členov projektu                                                  |
| `createdAt`       | string (ISO 8601)   | čas vytvorenia, napr. `2026-10-12T08:30:00.000Z`                       |

## GET /api/admin/projects

Vráti `200` s telom `{ projects: AdminProjectListItem[] }` (schéma `adminProjectListResponseSchema`) so všetkými projektmi, nielen tými, kde je admin členom. Zoradené podľa `name`, pri rovnakom názve podľa `id`. Bez stránkovania a filtrov.

```json
{
	"projects": [
		{
			"id": "0b7c2f4e-5a8d-4c1e-9f3a-2d6e8b1c4a77",
			"name": "B2B Admin",
			"slug": "b2b-admin",
			"primaryColor": "#E83E8C",
			"baseLanguageTag": "sk",
			"languageCount": 3,
			"memberCount": 2,
			"createdAt": "2026-10-12T08:30:00.000Z"
		}
	]
}
```

| HTTP | `code`                 | Kedy                                 |
| ---- | ---------------------- | ------------------------------------ |
| 200  |                        | zoznam projektov                     |
| 401  | `AUTH_UNAUTHENTICATED` | chýba alebo expirovala session       |
| 403  | `FORBIDDEN`            | prihlásený používateľ nie je `ADMIN` |

## DELETE /api/admin/projects/:projectId

Natrvalo zmaže projekt. Jeho členstvá (`ProjectMember`) a jazyky (`ProjectLanguage`) sa zmažú kaskádou, používatelia ostávajú, aj keď im nezostane žiadny projekt. Telo sa neposiela (stačí `{}` kvôli CSRF), potvrdenie prepísaním slugu robí iba frontend. Pri dvoch súbežných mazaniach toho istého projektu dostane druhé 404.

| HTTP | `code`                 | Kedy                                                     |
| ---- | ---------------------- | -------------------------------------------------------- |
| 204  |                        | projekt zmazaný                                          |
| 401  | `AUTH_UNAUTHENTICATED` | chýba alebo expirovala session                           |
| 403  | `FORBIDDEN`            | prihlásený používateľ nie je `ADMIN`                     |
| 403  | `CSRF_REJECTED`        | chýba CSRF hlavička alebo JSON telo (stačí `{}`)         |
| 404  | `NOT_FOUND`            | projekt s týmto `projectId` neexistuje alebo nie je UUID |

## Príklad (curl)

```bash
curl -i -c cookies.txt -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' -H 'X-Requested-With: XMLHttpRequest' \
  -d '{"email":"admin@firma.sk","password":"••••••••"}'
curl -i -b cookies.txt http://localhost:8080/api/admin/projects
curl -i -b cookies.txt -X DELETE http://localhost:8080/api/admin/projects/0b7c2f4e-5a8d-4c1e-9f3a-2d6e8b1c4a77 \
  -H 'Content-Type: application/json' -H 'X-Requested-With: XMLHttpRequest' -d '{}'
```
