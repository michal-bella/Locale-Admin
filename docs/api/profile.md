---
title: 'API: profil'
updated: 2026-10-17
notion_page_id:
---

# Profil (`/api/profile`)

Profil prihláseného používateľa: zobrazenie a úprava mena a priezviska. Email a rola sa tu meniť nedajú. Schémy sú v `packages/shared/src/profile.ts`.

| Metóda  | Cesta          | Prihlásenie        | Popis                                 |
| ------- | -------------- | ------------------ | ------------------------------------- |
| `GET`   | `/api/profile` | `ADMIN` / `EDITOR` | profil prihláseného používateľa       |
| `PATCH` | `/api/profile` | `ADMIN` / `EDITOR` | zmení meno a priezvisko, vráti profil |

Router `/api/profile` je za `requireAuth`, rola sa nekontroluje. Bez session vráti 401 `AUTH_UNAUTHENTICATED` (viď [auth](./auth.md#oprávnenia)). Endpoint vždy pracuje s používateľom zo session, ID v tele ani v ceste nie je.

## Odpoveď `Profile`

Schéma `profileSchema` = `AuthUser` (viď [auth](./auth.md#odpoveď-authuser)) a navyše `passwordChangedAt`. Hash hesla sa nikdy nevracia.

| Pole                | Typ                | Popis                                                  |
| ------------------- | ------------------ | ------------------------------------------------------ |
| `id`                | UUID               | ID používateľa                                         |
| `email`             | string             | normalizovaný email (malé písmená)                     |
| `role`              | `ADMIN` / `EDITOR` | globálna rola                                          |
| `firstName`         | string / `null`    | meno, `null` ak ešte nie je vyplnené                   |
| `lastName`          | string / `null`    | priezvisko, `null` ak ešte nie je vyplnené             |
| `passwordChangedAt` | string (ISO 8601)  | posledná zmena hesla, napr. `2026-10-12T08:30:00.000Z` |

```json
{
	"id": "6f1c0f8e-1b7e-4c47-9a53-0a4b1f3e2d11",
	"email": "meno@firma.sk",
	"role": "EDITOR",
	"firstName": "Jana",
	"lastName": "Nováková",
	"passwordChangedAt": "2026-10-12T08:30:00.000Z"
}
```

## GET /api/profile

Vráti `200` s `Profile` prihláseného používateľa.

| HTTP | `code`                 | Kedy                           |
| ---- | ---------------------- | ------------------------------ |
| 200  |                        | profil                         |
| 401  | `AUTH_UNAUTHENTICATED` | chýba alebo expirovala session |

## PATCH /api/profile

Telo (schéma `updateProfileRequestSchema`):

```json
{ "firstName": "Jana", "lastName": "Nováková" }
```

- `firstName` aj `lastName` sú povinné, po `trim()` majú 1 až 100 znakov (`PERSON_NAME_MAX_LENGTH`). Ukladajú sa orezané.
- Polia `email`, `role` a ďalšie v tele sa ignorujú (schéma ich nemá).
- Mení iba prihláseného používateľa. Pri úspechu vráti `200` s novým `Profile`; nové meno vracia hneď aj `GET /api/auth/me`.

| HTTP | `code`                 | Kedy                                                             |
| ---- | ---------------------- | ---------------------------------------------------------------- |
| 200  |                        | profil uložený, telo `Profile`                                   |
| 400  | `VALIDATION_ERROR`     | nevalidné telo, `details` podľa polí (viď nižšie)                |
| 401  | `AUTH_UNAUTHENTICATED` | chýba alebo expirovala session                                   |
| 403  | `CSRF_REJECTED`        | chýba CSRF hlavička alebo JSON telo (viď [auth](./auth.md#csrf)) |

Príklady `details` pri 400:

| Situácia            | `details`                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------- |
| prázdne meno        | `[{ "path": "firstName", "code": "REQUIRED" }]`                                             |
| meno dlhšie ako 100 | `[{ "path": "firstName", "code": "TOO_LONG", "params": { "max": 100 } }]`                   |
| chýbajúce polia     | `[{ "path": "firstName", "code": "REQUIRED" }, { "path": "lastName", "code": "REQUIRED" }]` |

## Príklad (curl)

```bash
curl -i -c cookies.txt -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' -H 'X-Requested-With: XMLHttpRequest' \
  -d '{"email":"meno@firma.sk","password":"••••••••"}'
curl -i -b cookies.txt http://localhost:8080/api/profile
curl -i -b cookies.txt -X PATCH http://localhost:8080/api/profile \
  -H 'Content-Type: application/json' -H 'X-Requested-With: XMLHttpRequest' \
  -d '{"firstName":"Jana","lastName":"Nováková"}'
```
