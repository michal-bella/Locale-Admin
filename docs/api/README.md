---
title: 'API'
updated: 2026-10-19
notion_page_id:
---

# API

Všetky endpointy sú pod `/api`. Request a response schémy sú v `packages/shared`.

## Endpointy

| Metóda   | Cesta                                                           | Popis                                                                             |
| -------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `GET`    | `/api/health`                                                   | stav backendu a databázy, [detail](./health.md)                                   |
| `POST`   | `/api/auth/login`                                               | prihlásenie, session cookie, [detail](./auth.md)                                  |
| `POST`   | `/api/auth/logout`                                              | odhlásenie, [detail](./auth.md)                                                   |
| `GET`    | `/api/auth/me`                                                  | prihlásený používateľ, [detail](./auth.md)                                        |
| `GET`    | `/api/admin/projects`                                           | všetky projekty s počtami (ADMIN), [detail](./admin-projects.md)                  |
| `DELETE` | `/api/admin/projects/:projectId`                                | zmazanie projektu (ADMIN), [detail](./admin-projects.md)                          |
| `GET`    | `/api/admin/users`                                              | zoznam všetkých používateľov (ADMIN), [detail](./admin-users.md)                  |
| `GET`    | `/api/admin/users/:id`                                          | detail používateľa s jeho projektmi (ADMIN), [detail](./admin-users.md)           |
| `POST`   | `/api/admin/users`                                              | vytvorenie používateľa s rolou (ADMIN), [detail](./admin-users.md)                |
| `DELETE` | `/api/admin/users/:id`                                          | odstránenie používateľa (ADMIN), [detail](./admin-users.md)                       |
| `GET`    | `/api/projects`                                                 | projekty používateľa (ADMIN všetky), [detail](./projects.md)                      |
| `POST`   | `/api/projects`                                                 | vytvorenie projektu, [detail](./projects.md)                                      |
| `DELETE` | `/api/projects/:projectId/membership`                           | opustenie projektu, [detail](./projects.md)                                       |
| `GET`    | `/api/projects/:projectId/settings`                             | nastavenia projektu (člen, ADMIN), [detail](./projects.md)                        |
| `PATCH`  | `/api/projects/:projectId/settings`                             | uloženie nastavení projektu, základný jazyk iba ADMIN, [detail](./projects.md)    |
| `GET`    | `/api/projects/:projectId/languages`                            | jazyky projektu (člen, ADMIN), [detail](./project-languages.md)                   |
| `POST`   | `/api/projects/:projectId/languages`                            | pridanie jazyka do projektu (člen, ADMIN), [detail](./project-languages.md)       |
| `DELETE` | `/api/projects/:projectId/languages/:languageId`                | odobratie jazyka z projektu (člen, ADMIN), [detail](./project-languages.md)       |
| `GET`    | `/api/projects/:projectId/members`                              | členovia projektu (člen, ADMIN), [detail](./projects.md)                          |
| `POST`   | `/api/projects/:projectId/members`                              | pridanie existujúceho používateľa do projektu (ADMIN), [detail](./projects.md)    |
| `DELETE` | `/api/projects/:projectId/members/:userId`                      | odobranie člena z projektu (ADMIN), [detail](./projects.md)                       |
| `GET`    | `/api/projects/:projectId/translations`                         | zoznam prekladov projektu (člen, ADMIN), [detail](./translations.md)              |
| `PUT`    | `/api/projects/:projectId/keys/:keyId/translations/:languageId` | uloženie prekladu kľúča v jazyku (člen, ADMIN), [detail](./translations.md)       |
| `PATCH`  | `/api/projects/:projectId/keys/:keyId`                          | úprava kľúča: názov, popis, plurál (iba ADMIN), [detail](./translations.md)       |
| `POST`   | `/api/projects/:projectId/imports/preview`                      | kontrola súboru pred importom, nič nezapíše (člen, ADMIN), [detail](./imports.md) |
| `POST`   | `/api/projects/:projectId/imports`                              | import súboru do projektu (člen, ADMIN), [detail](./imports.md)                   |
| `GET`    | `/api/profile`                                                  | profil prihláseného používateľa, [detail](./profile.md)                           |
| `PATCH`  | `/api/profile`                                                  | úprava mena a priezviska, [detail](./profile.md)                                  |
| `PATCH`  | `/api/profile/preferences`                                      | zobrazenie stránky Preklady (`translationsView`), [detail](./profile.md)          |

## Chybový kontrakt

Každá chyba má tvar `{ error: { code, message, details? } }`.

- `code` je stabilný reťazec z enumu `ERROR_CODE` v `packages/shared`.
- `message` je iba anglický text pre logy a vývojárov. Frontend ho nikdy nezobrazuje, prekladá iba `code`.
- `details` sa posiela pri validačných chybách: `[{ path: 'email', code: 'INVALID_EMAIL' }]`. Kódy sú z enumu `VALIDATION_CODE` (`REQUIRED`, `INVALID_EMAIL`, `TOO_SHORT`, `TOO_LONG`, `INVALID`). Pri `TOO_SHORT` a `TOO_LONG` je aj `params: { min }` alebo `{ max }`.
- Pri `IMPORT_FILE_INVALID` je `details` objekt `{ issues, total }` s chybami súboru (viď [import](./imports.md#chyby-súboru-import-sa-zablokuje)).
- Pri `PLACEHOLDER_MISMATCH` je `details` objekt `{ missing, extra }` s normalizovanými premennými (viď [preklady](./translations.md#ochrana-premenných)).

| HTTP | `code`                      | Kedy                                                                                                                           |
| ---- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 400  | `VALIDATION_ERROR`          | nevalidné telo požiadavky (zod) alebo poškodený JSON                                                                           |
| 400  | `IMPORT_COLUMNS_INVALID`    | priradenie stĺpcov importu k jazykom je neplatné (chýbajúci alebo cudzí stĺpec, cudzí alebo zdvojený jazyk, všetko preskočené) |
| 400  | `PLACEHOLDER_MISMATCH`      | preklad nemá rovnaké premenné `{{…}}` ako základný jazyk pri zapnutej ochrane premenných, `details: { missing, extra }`        |
| 413  | `VALIDATION_ERROR`          | telo požiadavky je väčšie ako 100 KB (okrem ciest importu)                                                                     |
| 413  | `IMPORT_FILE_TOO_LARGE`     | súbor importu nad 10 MB alebo telo požiadavky importu nad 12 MB                                                                |
| 415  | `VALIDATION_ERROR`          | nepodporovaný charset alebo `Content-Encoding` tela požiadavky                                                                 |
| 401  | `AUTH_INVALID_CREDENTIALS`  | zlý email alebo heslo, neaktívny user                                                                                          |
| 401  | `AUTH_UNAUTHENTICATED`      | chýba alebo expirovala session                                                                                                 |
| 403  | `FORBIDDEN`                 | prihlásený bez oprávnenia                                                                                                      |
| 403  | `CSRF_REJECTED`             | mutácia bez `Content-Type: application/json` a `X-Requested-With`                                                              |
| 404  | `NOT_FOUND`                 | neexistujúci endpoint alebo záznam (pod `/api/admin/*` iba pre ADMIN, inak 401/403), projekt mimo prístupu                     |
| 404  | `TRANSLATION_KEY_NOT_FOUND` | kľúč prekladu nie je UUID alebo nepatrí projektu                                                                               |
| 409  | `EMAIL_TAKEN`               | email už existuje                                                                                                              |
| 409  | `LANGUAGE_TAKEN`            | jazyk s týmto tagom už v projekte je                                                                                           |
| 409  | `LANGUAGE_IS_BASE`          | pokus odobrať základný jazyk projektu                                                                                          |
| 409  | `SLUG_TAKEN`                | projekt s týmto slugom už existuje                                                                                             |
| 409  | `LAST_MEMBER`               | posledný člen by opustil projekt alebo bol z neho odobraný                                                                     |
| 409  | `ALREADY_MEMBER`            | používateľ už je členom projektu                                                                                               |
| 409  | `SELF_DELETE`               | admin chce odstrániť vlastný účet                                                                                              |
| 409  | `LAST_ADMIN`                | posledný admin sa chce vzdať roly `ADMIN` (viď [profil](./profile.md))                                                         |
| 409  | `TRANSLATION_KEY_TAKEN`     | kľúč s týmto názvom už v namespace existuje (premenovanie kľúča)                                                               |
| 422  | `IMPORT_FILE_INVALID`       | importovaný súbor má chyby, `details: { issues, total }`                                                                       |
| 429  | `RATE_LIMITED`              | prekročený rate limit, s hlavičkou `Retry-After`                                                                               |
| 500  | `INTERNAL_ERROR`            | neočakávaná chyba, detail je iba v logu                                                                                        |

Pre validáciu tela požiadavky sa používa iba 400; 422 je vyhradené pre chyby v obsahu importovaného súboru. Chyby parsovania tela (413, 415 a ďalšie 4xx z `express.json()`) vracajú svoj HTTP status s kódom `VALIDATION_ERROR` (413 na cestách importu s kódom `IMPORT_FILE_TOO_LARGE`) a logujú sa ako `warn`, nie `error`. Kódy `AUTH_*`, `FORBIDDEN`, `CSRF_REJECTED` a `RATE_LIMITED` vracia backend od míľnika B (viď [auth](./auth.md)), `EMAIL_TAKEN` od míľnika C (viď [správa používateľov](./admin-users.md)), `LANGUAGE_TAKEN` a `LANGUAGE_IS_BASE` od stránky Jazyky (viď [jazyky projektu](./project-languages.md)), `SLUG_TAKEN` a `LAST_MEMBER` od projektov, `ALREADY_MEMBER` od pridávania existujúcich používateľov do projektu (viď [projekty](./projects.md)), `SELF_DELETE` od mazania používateľov (viď [správa používateľov](./admin-users.md)), `IMPORT_FILE_INVALID` a `IMPORT_FILE_TOO_LARGE` od kontroly importu, `IMPORT_COLUMNS_INVALID` od zápisu importu (viď [import](./imports.md)), `PLACEHOLDER_MISMATCH` a `TRANSLATION_KEY_NOT_FOUND` od úpravy prekladu, `TRANSLATION_KEY_TAKEN` od úpravy kľúča (viď [preklady](./translations.md)).
