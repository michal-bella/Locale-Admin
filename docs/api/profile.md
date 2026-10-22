---
title: 'API: profil'
updated: 2026-10-22
notion_page_id:
---

# Profil (`/api/profile`)

Profil prihláseného používateľa: zobrazenie a úprava mena, priezviska a (iba `ADMIN`) vlastnej globálnej roly a jeho preferencie (zobrazenie stránky Preklady) a zmena vlastného hesla. Email sa tu meniť nedá. Schémy sú v `packages/shared/src/profile.ts`.

| Metóda  | Cesta                      | Prihlásenie        | Popis                                           |
| ------- | -------------------------- | ------------------ | ----------------------------------------------- |
| `GET`   | `/api/profile`             | `ADMIN` / `EDITOR` | profil prihláseného používateľa                 |
| `PATCH` | `/api/profile`             | `ADMIN` / `EDITOR` | zmení meno, priezvisko a rolu, vráti profil     |
| `PATCH` | `/api/profile/preferences` | `ADMIN` / `EDITOR` | zmení zobrazenie stránky Preklady, vráti profil |
| `PUT`   | `/api/profile/password`    | `ADMIN` / `EDITOR` | zmení heslo po overení aktuálneho, vráti profil |

Router `/api/profile` je za `requireAuth`, rola sa nekontroluje. Bez session vráti 401 `AUTH_UNAUTHENTICATED` (viď [auth](./auth.md#oprávnenia)). Endpoint vždy pracuje s používateľom zo session, ID v tele ani v ceste nie je.

## Odpoveď `Profile`

Schéma `profileSchema` = `AuthUser` (viď [auth](./auth.md#odpoveď-authuser)) a navyše `passwordChangedAt`. Hash hesla sa nikdy nevracia.

| Pole                | Typ                            | Popis                                                                               |
| ------------------- | ------------------------------ | ----------------------------------------------------------------------------------- |
| `id`                | UUID                           | ID používateľa                                                                      |
| `email`             | string                         | normalizovaný email (malé písmená)                                                  |
| `role`              | `ADMIN` / `EDITOR` / `VISITOR` | globálna rola                                                                       |
| `firstName`         | string / `null`                | meno, `null` ak ešte nie je vyplnené                                                |
| `lastName`          | string / `null`                | priezvisko, `null` ak ešte nie je vyplnené                                          |
| `preferences`       | objekt                         | `{ translationsView, translationsLayout }` (viď [auth](./auth.md#odpoveď-authuser)) |
| `passwordChangedAt` | string (ISO 8601)              | posledná zmena hesla, napr. `2026-10-12T08:30:00.000Z`                              |

```json
{
	"id": "6f1c0f8e-1b7e-4c47-9a53-0a4b1f3e2d11",
	"email": "meno@firma.sk",
	"role": "EDITOR",
	"firstName": "Jana",
	"lastName": "Nováková",
	"preferences": { "translationsView": "EXTENDED", "translationsLayout": "COLUMNS" },
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
{ "firstName": "Jana", "lastName": "Nováková", "role": "EDITOR" }
```

- `firstName` aj `lastName` sú povinné, po `trim()` majú 1 až 100 znakov (`PERSON_NAME_MAX_LENGTH`). Ukladajú sa orezané.
- `role` (`ADMIN` / `EDITOR` / `VISITOR`) je voliteľná. Rovnaká ako aktuálna rola sa ignoruje; inú môže poslať iba `ADMIN` (inak 403 `FORBIDDEN`) a iba keď ostane aspoň jeden ďalší `ADMIN` (inak 409 `LAST_ADMIN`). Nová rola platí hneď aj pre `GET /api/auth/me` a oprávnenia ďalších požiadaviek.
- Pole `email` a ďalšie v tele sa ignorujú (schéma ich nemá).
- Mení iba prihláseného používateľa. Pri úspechu vráti `200` s novým `Profile`; nové meno vracia hneď aj `GET /api/auth/me`.

| HTTP | `code`                 | Kedy                                                             |
| ---- | ---------------------- | ---------------------------------------------------------------- |
| 200  |                        | profil uložený, telo `Profile`                                   |
| 400  | `VALIDATION_ERROR`     | nevalidné telo, `details` podľa polí (viď nižšie)                |
| 401  | `AUTH_UNAUTHENTICATED` | chýba alebo expirovala session                                   |
| 403  | `FORBIDDEN`            | `EDITOR` alebo `VISITOR` poslal inú rolu, než má                 |
| 403  | `CSRF_REJECTED`        | chýba CSRF hlavička alebo JSON telo (viď [auth](./auth.md#csrf)) |
| 409  | `LAST_ADMIN`           | posledný `ADMIN` sa chce vzdať roly                              |

Príklady `details` pri 400:

| Situácia            | `details`                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------- |
| prázdne meno        | `[{ "path": "firstName", "code": "REQUIRED" }]`                                             |
| meno dlhšie ako 100 | `[{ "path": "firstName", "code": "TOO_LONG", "params": { "max": 100 } }]`                   |
| chýbajúce polia     | `[{ "path": "firstName", "code": "REQUIRED" }, { "path": "lastName", "code": "REQUIRED" }]` |
| neznáma rola        | `[{ "path": "role", "code": "INVALID" }]`                                                   |

## PATCH /api/profile/preferences

Telo (schéma `updatePreferencesRequestSchema`):

```json
{ "translationsView": "COMPACT" }
```

- Aspoň jedno z polí `translationsView` a `translationsLayout`, chýbajúce sa nemení.
- `translationsView`: `EXTENDED` (všetky jazyky projektu vedľa seba, predvolené pre nového používateľa) alebo `COMPACT` (zdrojový → cieľový jazyk). Stránka Preklady pošle zmenu hneď pri prepnutí a zobrazenie si používateľ ponesie na každom zariadení.
- `translationsLayout`: `COLUMNS` (jazyky vedľa seba, predvolené) alebo `STACKED` (jazyky pod sebou).
- Mení iba prihláseného používateľa. Pri úspechu vráti `200` s novým `Profile`; novú hodnotu vracia hneď aj `GET /api/auth/me`.

| HTTP | `code`                 | Kedy                                                                                               |
| ---- | ---------------------- | -------------------------------------------------------------------------------------------------- |
| 200  |                        | preferencia uložená, telo `Profile`                                                                |
| 400  | `VALIDATION_ERROR`     | neznáma hodnota (`details` `[{ "path": "translationsView", … }]`) alebo prázdne telo (`path` `""`) |
| 401  | `AUTH_UNAUTHENTICATED` | chýba alebo expirovala session                                                                     |
| 403  | `CSRF_REJECTED`        | chýba CSRF hlavička alebo JSON telo                                                                |

## PUT /api/profile/password

Telo (schéma `changePasswordRequestSchema`):

```json
{ "currentPassword": "staré heslo", "newPassword": "nové heslo" }
```

- `currentPassword` je povinné a musí sa zhodovať s aktuálnym heslom (argon2), inak 400 `PASSWORD_INCORRECT` a nič sa nemení.
- `newPassword` má 8 až 128 znakov (`passwordSchema`, rovnaké pravidlá ako pri vytvorení používateľa). Môže byť rovnaké ako aktuálne.
- Mení iba prihláseného používateľa: uloží nový hash a nastaví `passwordChangedAt` na teraz. Pri úspechu vráti `200` s novým `Profile`.
- Zámerne jednoduché: žiadne e-maily, tokeny ani notifikácie. Existujúce sessions (aj v iných prehliadačoch) zostávajú prihlásené.

| HTTP | `code`                 | Kedy                                                                |
| ---- | ---------------------- | ------------------------------------------------------------------- |
| 200  |                        | heslo zmenené, telo `Profile`                                       |
| 400  | `VALIDATION_ERROR`     | chýbajúce pole alebo krátke / dlhé nové heslo, `details` podľa polí |
| 400  | `PASSWORD_INCORRECT`   | `currentPassword` nesedí                                            |
| 401  | `AUTH_UNAUTHENTICATED` | chýba alebo expirovala session                                      |
| 403  | `CSRF_REJECTED`        | chýba CSRF hlavička alebo JSON telo                                 |

Príklady `details` pri 400 `VALIDATION_ERROR`:

| Situácia                 | `details`                                                                  |
| ------------------------ | -------------------------------------------------------------------------- |
| chýba aktuálne heslo     | `[{ "path": "currentPassword", "code": "REQUIRED" }]`                      |
| nové heslo kratšie ako 8 | `[{ "path": "newPassword", "code": "TOO_SHORT", "params": { "min": 8 } }]` |

## Príklad (curl)

```bash
curl -i -c cookies.txt -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' -H 'X-Requested-With: XMLHttpRequest' \
  -d '{"email":"meno@firma.sk","password":"••••••••"}'
curl -i -b cookies.txt http://localhost:8080/api/profile
curl -i -b cookies.txt -X PATCH http://localhost:8080/api/profile \
  -H 'Content-Type: application/json' -H 'X-Requested-With: XMLHttpRequest' \
  -d '{"firstName":"Jana","lastName":"Nováková"}'
curl -i -b cookies.txt -X PATCH http://localhost:8080/api/profile/preferences \
  -H 'Content-Type: application/json' -H 'X-Requested-With: XMLHttpRequest' \
  -d '{"translationsView":"COMPACT"}'
curl -i -b cookies.txt -X PUT http://localhost:8080/api/profile/password \
  -H 'Content-Type: application/json' -H 'X-Requested-With: XMLHttpRequest' \
  -d '{"currentPassword":"••••••••","newPassword":"••••••••••"}'
```
