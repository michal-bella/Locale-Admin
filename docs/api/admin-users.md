---
title: 'API: správa používateľov'
updated: 2026-10-25
notion_page_id:
---

# Správa používateľov (`/api/admin/users`)

Zoznam všetkých používateľov, detail používateľa s jeho projektmi, vytvorenie používateľa s globálnou rolou (`ADMIN` alebo `USER`; rolu v projekte nastavuje admin pri pridaní do projektu) a jeho odstránenie. Registrácia neexistuje a toto je jediná cesta, ako používateľ vzniká; do projektov sa existujúci používatelia pridávajú na stránke Členovia projektu (viď [projekty](./projects.md#členovia)). Editácia a deaktivácia nie sú, meno si každý mení v profile. Schémy sú v `packages/shared/src/adminUsers.ts`.

| Metóda   | Cesta                  | Prihlásenie | Popis                                       |
| -------- | ---------------------- | ----------- | ------------------------------------------- |
| `GET`    | `/api/admin/users`     | `ADMIN`     | zoznam všetkých používateľov od najnovšieho |
| `GET`    | `/api/admin/users/:id` | `ADMIN`     | detail používateľa s jeho projektmi         |
| `POST`   | `/api/admin/users`     | `ADMIN`     | vytvorí používateľa s danou rolou           |
| `PATCH`  | `/api/admin/users/:id` | `ADMIN`     | zmení globálnu rolu používateľa             |
| `DELETE` | `/api/admin/users/:id` | `ADMIN`     | odstráni používateľa                        |

Celý router `/api/admin` je za `requireAuth` a `requireRole(ROLE.ADMIN)`: bez session vráti 401 `AUTH_UNAUTHENTICATED`, prihlásený `USER` (aj `MANAGER` projektu) dostane 403 `FORBIDDEN` (viď [auth](./auth.md#oprávnenia)).

## Odpoveď `AdminUser`

Schéma `adminUserSchema`. Hash hesla sa nikdy nevracia (backend ho z databázy ani nečíta).

| Pole           | Typ               | Popis                                            |
| -------------- | ----------------- | ------------------------------------------------ |
| `id`           | UUID              | ID používateľa                                   |
| `email`        | string            | normalizovaný email (malé písmená)               |
| `role`         | `ADMIN` / `USER`  | globálna rola                                    |
| `projectCount` | number            | počet projektov, v ktorých je členom             |
| `createdAt`    | string (ISO 8601) | čas vytvorenia, napr. `2026-10-12T08:30:00.000Z` |

```json
{ "id": "6f1c0f8e-1b7e-4c47-9a53-0a4b1f3e2d11", "email": "meno@firma.sk", "role": "USER", "projectCount": 2, "createdAt": "2026-10-12T08:30:00.000Z" }
```

## GET /api/admin/users

Vráti `200` s telom `{ users: AdminUser[] }` (schéma `adminUserListResponseSchema`) so všetkými používateľmi (každá rola), zoradené podľa `createdAt` od najnovšieho. `projectCount` je počet členstiev (`_count.projectMemberships`). Bez stránkovania a filtrov; obálka `users` nechá miesto na stránkovanie neskôr. Modál Pridať člena na stránke Členovia projektu z tohto zoznamu vyberá používateľa.

```json
{
	"users": [
		{ "id": "6f1c0f8e-1b7e-4c47-9a53-0a4b1f3e2d11", "email": "meno@firma.sk", "role": "USER", "projectCount": 2, "createdAt": "2026-10-12T08:30:00.000Z" }
	]
}
```

| HTTP | `code`                 | Kedy                                 |
| ---- | ---------------------- | ------------------------------------ |
| 200  |                        | zoznam používateľov                  |
| 401  | `AUTH_UNAUTHENTICATED` | chýba alebo expirovala session       |
| 403  | `FORBIDDEN`            | prihlásený používateľ nie je `ADMIN` |

## GET /api/admin/users/:id

Vráti `200` s telom `AdminUserDetail` (schéma `adminUserDetailSchema`): polia `AdminUser` a navyše `projects`, projekty, v ktorých je používateľ členom, zoradené podľa názvu. Stránka Detail používateľa (`/admin/users/$userId`) z neho zobrazuje kartu účtu a tabuľku projektov; pridanie a odobratie projektu idú cez `POST` a `DELETE /api/projects/:projectId/members` (viď [projekty](./projects.md#členovia)), nový endpoint na to nie je.

| Pole `projects[]` | Typ               | Popis                                                   |
| ----------------- | ----------------- | ------------------------------------------------------- |
| `id`              | UUID              | ID projektu                                             |
| `name`            | string            | názov projektu                                          |
| `slug`            | string            | slug projektu (URL stránok projektu)                    |
| `primaryColor`    | string            | primárna farba projektu, napr. `#E83E8C`                |
| `role`            | string            | rola v projekte: `MANAGER`, `EDITOR` alebo `VISITOR`    |
| `joinedAt`        | string (ISO 8601) | kedy bol používateľ pridaný (`ProjectMember.createdAt`) |

```json
{
	"id": "6f1c0f8e-1b7e-4c47-9a53-0a4b1f3e2d11",
	"email": "meno@firma.sk",
	"role": "USER",
	"projectCount": 1,
	"createdAt": "2026-10-12T08:30:00.000Z",
	"projects": [
		{
			"id": "0b6f6f5e-2f4e-4a3b-9c1d-1e2f3a4b5c6d",
			"name": "B2B admin",
			"slug": "b2b-admin",
			"primaryColor": "#E83E8C",
			"role": "MANAGER",
			"joinedAt": "2026-10-13T09:00:00.000Z"
		}
	]
}
```

| HTTP | `code`                 | Kedy                                                      |
| ---- | ---------------------- | --------------------------------------------------------- |
| 200  |                        | detail používateľa                                        |
| 401  | `AUTH_UNAUTHENTICATED` | chýba alebo expirovala session                            |
| 403  | `FORBIDDEN`            | prihlásený používateľ nie je `ADMIN` (ani pre vlastné id) |
| 404  | `NOT_FOUND`            | používateľ s týmto `id` neexistuje alebo `id` nie je UUID |

## POST /api/admin/users

Telo (schéma `createUserRequestSchema`):

```json
{ "email": "meno@firma.sk", "password": "••••••••", "role": "USER" }
```

- `email` musí byť platný email. Pred uložením sa upraví cez `trim()` a malé písmená.
- `password` má 8 až 128 znakov (`PASSWORD_MIN_LENGTH`, `PASSWORD_MAX_LENGTH`). Ukladá sa iba argon2id hash.
- `role` je povinné, `ADMIN` alebo `USER` (pracuje iba v projektoch, kam ho pridá admin, s rolou `MANAGER`, `EDITOR` alebo `VISITOR` podľa členstva; [projekty](./projects.md#prístup-k-projektu)). Chýbajúca aj neznáma rola vráti `details` s kódom `INVALID` (zod pri enume nerozlíši chýbajúcu hodnotu). `passwordChangedAt` sa nastaví na čas vytvorenia.
- Email je unikátny bez ohľadu na veľkosť písmen. Duplicitu stráži unikátny index v databáze, takže 409 vráti aj pri dvoch súbežných požiadavkách s rovnakým emailom.
- Pri úspechu vráti `201` s `AdminUser`. Nový používateľ sa hneď vie prihlásiť cez `POST /api/auth/login`.

| HTTP | `code`                 | Kedy                                                             |
| ---- | ---------------------- | ---------------------------------------------------------------- |
| 201  |                        | používateľ vytvorený, telo `AdminUser`                           |
| 400  | `VALIDATION_ERROR`     | nevalidné telo, `details` podľa polí (viď nižšie)                |
| 401  | `AUTH_UNAUTHENTICATED` | chýba alebo expirovala session                                   |
| 403  | `FORBIDDEN`            | prihlásený používateľ nie je `ADMIN`                             |
| 403  | `CSRF_REJECTED`        | chýba CSRF hlavička alebo JSON telo (viď [auth](./auth.md#csrf)) |
| 409  | `EMAIL_TAKEN`          | používateľ s týmto emailom už existuje                           |

Príklady `details` pri 400:

| Situácia        | `details`                                                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| zlý email       | `[{ "path": "email", "code": "INVALID_EMAIL" }]`                                                                               |
| krátke heslo    | `[{ "path": "password", "code": "TOO_SHORT", "params": { "min": 8 } }]`                                                        |
| neznáma rola    | `[{ "path": "role", "code": "INVALID" }]`                                                                                      |
| chýbajúce polia | `[{ "path": "email", "code": "REQUIRED" }, { "path": "password", "code": "REQUIRED" }, { "path": "role", "code": "INVALID" }]` |

## PATCH /api/admin/users/:id

Telo (schéma `updateUserRequestSchema`), aspoň jedno z polí:

```json
{ "role": "ADMIN", "email": "jana@firma.sk" }
```

- `role` (voliteľné) je `ADMIN` alebo `USER`. Mení ktoréhokoľvek používateľa vrátane vlastného účtu; nová rola platí hneď (ďalšia požiadavka aj `GET /api/auth/me` ju už vrátia). Kto sa stane `ADMIN`-om, stratí v tej istej transakcii všetky členstvá v projektoch (`ADMIN` má prístup ku všetkým bez členstva).
- Posledný `ADMIN` sa nemôže stať `USER`-om (409 `LAST_ADMIN`), aby mal kto spravovať používateľov. Rovnakú rolu, akú používateľ má, vráti 200 bez zmeny.
- `email` (voliteľné) sa uloží normalizovaný (orezaný, malými písmenami) ako pri vytvorení. Používateľ sa odteraz prihlasuje novým emailom; heslo a session ostávajú. Email iného používateľa vráti 409 `EMAIL_TAKEN` a nezmení sa nič (ani rola z toho istého tela).
- Pri úspechu vráti `200` s `AdminUserDetail` (ako `GET /api/admin/users/:id`).

| HTTP | `code`                 | Kedy                                                                                                                      |
| ---- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 200  |                        | uložené, telo `AdminUserDetail`                                                                                           |
| 400  | `VALIDATION_ERROR`     | neznáma rola (`[{ "path": "role", "code": "INVALID" }]`), neplatný email (`INVALID_EMAIL` pri `email`) alebo prázdne telo |
| 401  | `AUTH_UNAUTHENTICATED` | chýba alebo expirovala session                                                                                            |
| 403  | `FORBIDDEN`            | prihlásený používateľ nie je `ADMIN`                                                                                      |
| 403  | `CSRF_REJECTED`        | chýba CSRF hlavička alebo JSON telo                                                                                       |
| 404  | `NOT_FOUND`            | používateľ s týmto `id` neexistuje alebo `id` nie je UUID                                                                 |
| 409  | `LAST_ADMIN`           | posledný `ADMIN` by prišiel o rolu                                                                                        |
| 409  | `EMAIL_TAKEN`          | email už má iný používateľ                                                                                                |

## DELETE /api/admin/users/:id

Odstráni ktoréhokoľvek používateľa (každá rola). Jeho session a členstvá v projektoch sa zmažú kaskádou, preto sa hneď odhlási a zmizne zo zoznamov členov. Vlastný účet odstrániť nejde, takže vždy ostane aspoň jeden admin. Projekt môže ostať bez člena; `ADMIN` ho ďalej vidí a spravuje. Odobratie z jedného projektu bez zmazania účtu je `DELETE /api/projects/:projectId/members/:userId` (viď [projekty](./projects.md#členovia)).

| HTTP | `code`                 | Kedy                                                      |
| ---- | ---------------------- | --------------------------------------------------------- |
| 204  |                        | používateľ odstránený                                     |
| 401  | `AUTH_UNAUTHENTICATED` | chýba alebo expirovala session                            |
| 403  | `FORBIDDEN`            | prihlásený používateľ nie je `ADMIN`                      |
| 403  | `CSRF_REJECTED`        | chýba CSRF hlavička alebo JSON telo (stačí `{}`)          |
| 404  | `NOT_FOUND`            | používateľ s týmto `id` neexistuje alebo `id` nie je UUID |
| 409  | `SELF_DELETE`          | pokus odstrániť vlastný účet                              |

## Príklad (curl)

```bash
curl -i -c cookies.txt -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' -H 'X-Requested-With: XMLHttpRequest' \
  -d '{"email":"admin@firma.sk","password":"••••••••"}'
curl -i -b cookies.txt http://localhost:8080/api/admin/users
curl -i -b cookies.txt http://localhost:8080/api/admin/users/6f1c0f8e-1b7e-4c47-9a53-0a4b1f3e2d11
curl -i -b cookies.txt -X POST http://localhost:8080/api/admin/users \
  -H 'Content-Type: application/json' -H 'X-Requested-With: XMLHttpRequest' \
  -d '{"email":"meno@firma.sk","password":"••••••••","role":"USER"}'
curl -i -b cookies.txt -X PATCH http://localhost:8080/api/admin/users/6f1c0f8e-1b7e-4c47-9a53-0a4b1f3e2d11 \
  -H 'Content-Type: application/json' -H 'X-Requested-With: XMLHttpRequest' \
  -d '{"role":"ADMIN"}'
```
