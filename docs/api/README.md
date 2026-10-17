---
title: 'API'
updated: 2026-10-17
notion_page_id:
---

# API

Všetky endpointy sú pod `/api`. Request a response schémy sú v `packages/shared`.

## Endpointy

| Metóda   | Cesta                      | Popis                                                                          |
| -------- | -------------------------- | ------------------------------------------------------------------------------ |
| `GET`    | `/api/health`              | stav backendu a databázy, [detail](./health.md)                                |
| `POST`   | `/api/auth/login`          | prihlásenie, session cookie, [detail](./auth.md)                               |
| `POST`   | `/api/auth/logout`         | odhlásenie, [detail](./auth.md)                                                |
| `GET`    | `/api/auth/me`             | prihlásený používateľ, [detail](./auth.md)                                     |
| `GET`    | `/api/admin/users`         | zoznam používateľov (ADMIN), [detail](./admin-users.md)                        |
| `POST`   | `/api/admin/users`         | vytvorenie používateľa (ADMIN), [detail](./admin-users.md)                     |
| `GET`    | `/api/admin/languages`     | zoznam jazykov (ADMIN), [detail](./admin-languages.md)                         |
| `POST`   | `/api/admin/languages`     | pridanie jazyka z katalógu (ADMIN), [detail](./admin-languages.md)             |
| `PATCH`  | `/api/admin/languages/:id` | úprava jazyka, zmena základného jazyka (ADMIN), [detail](./admin-languages.md) |
| `DELETE` | `/api/admin/languages/:id` | odstránenie jazyka (ADMIN), [detail](./admin-languages.md)                     |
| `GET`    | `/api/profile`             | profil prihláseného používateľa, [detail](./profile.md)                        |
| `PATCH`  | `/api/profile`             | úprava mena a priezviska, [detail](./profile.md)                               |

## Chybový kontrakt

Každá chyba má tvar `{ error: { code, message, details? } }`.

- `code` je stabilný reťazec z enumu `ERROR_CODE` v `packages/shared`.
- `message` je iba anglický text pre logy a vývojárov. Frontend ho nikdy nezobrazuje, prekladá iba `code`.
- `details` sa posiela pri validačných chybách: `[{ path: 'email', code: 'INVALID_EMAIL' }]`. Kódy sú z enumu `VALIDATION_CODE` (`REQUIRED`, `INVALID_EMAIL`, `TOO_SHORT`, `TOO_LONG`, `INVALID`). Pri `TOO_SHORT` a `TOO_LONG` je aj `params: { min }` alebo `{ max }`.

| HTTP | `code`                     | Kedy                                                                                |
| ---- | -------------------------- | ----------------------------------------------------------------------------------- |
| 400  | `VALIDATION_ERROR`         | nevalidné telo požiadavky (zod) alebo poškodený JSON                                |
| 413  | `VALIDATION_ERROR`         | telo požiadavky je väčšie ako 100 KB                                                |
| 415  | `VALIDATION_ERROR`         | nepodporovaný charset alebo `Content-Encoding` tela požiadavky                      |
| 401  | `AUTH_INVALID_CREDENTIALS` | zlý email alebo heslo, neaktívny user                                               |
| 401  | `AUTH_UNAUTHENTICATED`     | chýba alebo expirovala session                                                      |
| 403  | `FORBIDDEN`                | prihlásený bez oprávnenia                                                           |
| 403  | `CSRF_REJECTED`            | mutácia bez `Content-Type: application/json` a `X-Requested-With`                   |
| 404  | `NOT_FOUND`                | neexistujúci endpoint alebo záznam (pod `/api/admin/*` iba pre ADMIN, inak 401/403) |
| 409  | `EMAIL_TAKEN`              | email už existuje                                                                   |
| 409  | `LANGUAGE_TAKEN`           | jazyk s týmto tagom už existuje                                                     |
| 409  | `LANGUAGE_IS_BASE`         | pokus odstrániť základný jazyk                                                      |
| 429  | `RATE_LIMITED`             | prekročený rate limit, s hlavičkou `Retry-After`                                    |
| 500  | `INTERNAL_ERROR`           | neočakávaná chyba, detail je iba v logu                                             |

Pre validáciu sa používa iba 400, nie 422. Chyby parsovania tela (413, 415 a ďalšie 4xx z `express.json()`) vracajú svoj HTTP status s kódom `VALIDATION_ERROR` a logujú sa ako `warn`, nie `error`. Kódy `AUTH_*`, `FORBIDDEN`, `CSRF_REJECTED` a `RATE_LIMITED` vracia backend od míľnika B (viď [auth](./auth.md)), `EMAIL_TAKEN` od míľnika C (viď [správa používateľov](./admin-users.md)), `LANGUAGE_TAKEN` a `LANGUAGE_IS_BASE` od stránky Jazyky (viď [jazyky](./admin-languages.md)).
