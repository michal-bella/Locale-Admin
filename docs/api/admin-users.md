---
title: 'API: správa používateľov'
updated: 2026-10-16
notion_page_id:
---

# Správa používateľov (`/api/admin/users`)

Zoznam používateľov a vytvorenie nového používateľa. Registrácia neexistuje, nových používateľov vytvára iba `ADMIN`. Editácia, deaktivácia ani mazanie vo fáze 1 nie sú. Schémy sú v `packages/shared/src/adminUsers.ts`.

| Metóda | Cesta              | Prihlásenie | Popis                                |
| ------ | ------------------ | ----------- | ------------------------------------ |
| `GET`  | `/api/admin/users` | `ADMIN`     | zoznam používateľov od najnovšieho   |
| `POST` | `/api/admin/users` | `ADMIN`     | vytvorí používateľa s rolou `EDITOR` |

Celý router `/api/admin` je za `requireAuth` a `requireRole(ROLE.ADMIN)`: bez session vráti 401 `AUTH_UNAUTHENTICATED`, prihlásený `EDITOR` dostane 403 `FORBIDDEN` (viď [auth](./auth.md#oprávnenia)).

## Odpoveď `AdminUser`

Schéma `adminUserSchema`. Hash hesla sa nikdy nevracia (backend ho z databázy ani nečíta).

| Pole        | Typ                | Popis                                            |
| ----------- | ------------------ | ------------------------------------------------ |
| `id`        | UUID               | ID používateľa                                   |
| `email`     | string             | normalizovaný email (malé písmená)               |
| `role`      | `ADMIN` / `EDITOR` | globálna rola                                    |
| `createdAt` | string (ISO 8601)  | čas vytvorenia, napr. `2026-10-12T08:30:00.000Z` |

```json
{ "id": "6f1c0f8e-1b7e-4c47-9a53-0a4b1f3e2d11", "email": "meno@firma.sk", "role": "EDITOR", "createdAt": "2026-10-12T08:30:00.000Z" }
```

## GET /api/admin/users

Vráti `200` s telom `{ users: AdminUser[] }` (schéma `adminUserListResponseSchema`), zoradené podľa `createdAt` od najnovšieho. Bez stránkovania a filtrov; obálka `users` nechá miesto na stránkovanie neskôr.

```json
{ "users": [{ "id": "6f1c0f8e-1b7e-4c47-9a53-0a4b1f3e2d11", "email": "meno@firma.sk", "role": "EDITOR", "createdAt": "2026-10-12T08:30:00.000Z" }] }
```

| HTTP | `code`                 | Kedy                                 |
| ---- | ---------------------- | ------------------------------------ |
| 200  |                        | zoznam používateľov                  |
| 401  | `AUTH_UNAUTHENTICATED` | chýba alebo expirovala session       |
| 403  | `FORBIDDEN`            | prihlásený používateľ nie je `ADMIN` |

## POST /api/admin/users

Telo (schéma `createUserRequestSchema`):

```json
{ "email": "meno@firma.sk", "password": "••••••••" }
```

- `email` musí byť platný email. Pred uložením sa upraví cez `trim()` a malé písmená.
- `password` má 8 až 128 znakov (`PASSWORD_MIN_LENGTH`, `PASSWORD_MAX_LENGTH`). Ukladá sa iba argon2id hash.
- Rola je vždy `EDITOR`. Pole `role` v tele sa ignoruje (schéma ho nemá). `passwordChangedAt` sa nastaví na čas vytvorenia.
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

| Situácia        | `details`                                                                               |
| --------------- | --------------------------------------------------------------------------------------- |
| zlý email       | `[{ "path": "email", "code": "INVALID_EMAIL" }]`                                        |
| krátke heslo    | `[{ "path": "password", "code": "TOO_SHORT", "params": { "min": 8 } }]`                 |
| chýbajúce polia | `[{ "path": "email", "code": "REQUIRED" }, { "path": "password", "code": "REQUIRED" }]` |

## Príklad (curl)

```bash
curl -i -c cookies.txt -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' -H 'X-Requested-With: XMLHttpRequest' \
  -d '{"email":"admin@firma.sk","password":"••••••••"}'
curl -i -b cookies.txt http://localhost:8080/api/admin/users
curl -i -b cookies.txt -X POST http://localhost:8080/api/admin/users \
  -H 'Content-Type: application/json' -H 'X-Requested-With: XMLHttpRequest' \
  -d '{"email":"meno@firma.sk","password":"••••••••"}'
```
