---
title: 'Databáza'
updated: 2026-10-18
notion_page_id:
---

# Databáza

PostgreSQL 17, Prisma 7 s driver adapterom `@prisma/adapter-pg`. Schéma je v `backend/prisma/schema.prisma`, konfigurácia Prisma CLI v `backend/prisma.config.ts` (načíta root `.env`, už nastavené premenné majú prednosť). Prisma klient sa generuje do `backend/src/generated/prisma` (nie je v gite).

## Dátový model

### User

| Pole                     | Typ                | Poznámka                                                                                |
| ------------------------ | ------------------ | --------------------------------------------------------------------------------------- |
| `id`                     | UUID               | PK                                                                                      |
| `email`                  | string, unique     | uložený normalizovaný (`trim()` + malé písmená)                                         |
| `passwordHash`           | string             | argon2id, nikdy sa nevracia v API                                                       |
| `role`                   | enum `ROLE`        | `ADMIN` alebo `EDITOR`, default `EDITOR`; `POST /api/admin/users` zakladá vždy `EDITOR` |
| `firstName`, `lastName`  | string, nullable   | upravuje ich používateľ na obrazovke Môj profil (`PATCH /api/profile`)                  |
| `isActive`               | boolean            | default `true`, neaktívny user sa neprihlási                                            |
| `lastLoginAt`            | datetime, nullable | nastaví sa pri úspešnom logine                                                          |
| `passwordChangedAt`      | datetime           | default čas vytvorenia                                                                  |
| `createdAt`, `updatedAt` | datetime           |                                                                                         |

### Session

Server-side session pre prihlásenie. Jeden riadok = jedno prihlásenie v jednom prehliadači. Správanie API je v [API: auth](./api/auth.md).

| Pole         | Typ            | Poznámka                                                                                   |
| ------------ | -------------- | ------------------------------------------------------------------------------------------ |
| `id`         | UUID           | PK                                                                                         |
| `userId`     | UUID           | FK na `User`, pri zmazaní usera sa zmaže                                                   |
| `tokenHash`  | string, unique | SHA-256 (hex) tokenu z cookie `locale_session`; samotný token sa neukladá                  |
| `createdAt`  | datetime       | čas prihlásenia, od neho sa počíta absolútny limit `SESSION_MAX_AGE_DAYS` (default 30 dní) |
| `lastUsedAt` | datetime       | posledná zapísaná aktivita; zapisuje sa najviac raz za 5 minút                             |
| `expiresAt`  | datetime       | `min(lastUsedAt + SESSION_TTL_DAYS, createdAt + SESSION_MAX_AGE_DAYS)`, default TTL 7 dní  |

Životný cyklus:

- **Login** vytvorí riadok (`createdAt = lastUsedAt = teraz`) a zmaže všetky riadky s `expiresAt` v minulosti.
- **Požiadavka s prihlásením:** ak od `lastUsedAt` prešlo aspoň 5 minút, nastaví sa `lastUsedAt = teraz` a prepočíta `expiresAt`. Inak sa do DB nezapisuje.
- **Expirácia:** session s `expiresAt` v minulosti alebo staršia ako absolútny limit sa pri použití zmaže (401). Rovnako session neaktívneho usera.
- **Logout** zmaže riadok aktuálnej session, ostatné session usera ostanú.

Indexy: `userId`, `expiresAt`.

### Language

Jazyk, do ktorého sa prekladá. Kým neexistujú projekty, je to jeden globálny zoznam. Tag aj predvolené názvy a vlajka sú z katalógu `SUPPORTED_LANGUAGES` v `packages/shared`. Správanie API je v [API: jazyky](./api/admin-languages.md).

| Pole                     | Typ            | Poznámka                                                          |
| ------------------------ | -------------- | ----------------------------------------------------------------- |
| `id`                     | UUID           | PK                                                                |
| `tag`                    | string, unique | tag z katalógu (`sk`, `en`, `de-AT`, ...), po vytvorení sa nemení |
| `englishName`            | string         | anglický názov, pri vytvorení z katalógu, ADMIN ho môže upraviť   |
| `nativeName`             | string         | pôvodný názov, pri vytvorení z katalógu, ADMIN ho môže upraviť    |
| `flagCode`               | string         | ISO 3166-1 kód krajiny malými písmenami (`sk`, `gb`, `at`)        |
| `isBase`                 | boolean        | default `false`, základný jazyk; prvý pridaný jazyk je základný   |
| `createdAt`, `updatedAt` | datetime       |                                                                   |

Indexy: unikátny `tag` a čiastočný unikátny index `Language_isBase_key` na `isBase` s podmienkou `WHERE "isBase"`. Ten zaručí, že základný jazyk je najviac jeden. Prisma ho v `schema.prisma` nevie vyjadriť, je ručne pridaný v migrácii `add_language` (a `prisma migrate dev` ho nemaže).

Zápisy, ktoré čítajú alebo presúvajú príznak `isBase` (vytvorenie, `PATCH` s `isBase: true`, odstránenie, uloženie nastavení projektu cez `setBaseLanguage`), berú v transakcii advisory zámok `pg_advisory_xact_lock` s konštantným kľúčom (`BASE_LANGUAGE_LOCK_KEY` v `adminLanguages.service.ts`). Pri READ COMMITTED by inak súbežné požiadavky narazili na index `Language_isBase_key`.

### Project

Projekt (jeden prekladový hárok). Projekty vytvárajú používatelia na index stránke, seed vytvorí prvý projekt. Správanie API je v [API: projekty a členovia](./api/projects.md).

| Pole                     | Typ            | Poznámka                                                              |
| ------------------------ | -------------- | --------------------------------------------------------------------- |
| `id`                     | UUID           | PK                                                                    |
| `name`                   | string         | názov projektu, 1 až 100 znakov                                       |
| `slug`                   | string, unique | malé písmená, číslice a pomlčky (`b2b-admin`), 1 až 50 znakov         |
| `primaryColor`           | string         | `#RRGGBB` veľkými písmenami, default `#E83E8C`; zatiaľ sa iba ukladá  |
| `protectVariables`       | boolean        | default `true`, chrániť výrazy `{{ variable }}`; zatiaľ sa iba ukladá |
| `createdAt`, `updatedAt` | datetime       |                                                                       |

Projekt nemá vlastný základný jazyk, používa globálny `Language.isBase`.

### ProjectMember

Členstvo používateľa v projekte. Určuje, ktoré projekty vidí `EDITOR` a ku ktorým má prístup (`ADMIN` má prístup ku všetkým). Vzniká pri vytvorení projektu (tvorca), pri vytvorení člena na stránke Členovia a zo seedu; zaniká akciou Opustiť projekt.

| Pole        | Typ      | Poznámka                                       |
| ----------- | -------- | ---------------------------------------------- |
| `projectId` | UUID     | FK na `Project`, pri zmazaní projektu sa zmaže |
| `userId`    | UUID     | FK na `User`, pri zmazaní usera sa zmaže       |
| `createdAt` | datetime | čas pridania do projektu                       |

PK je dvojica (`projectId`, `userId`), index na `userId`. Používateľ má spätnú reláciu `projectMemberships`.

```mermaid
erDiagram
    User ||--o{ Session : "má"
    User ||--o{ ProjectMember : "je členom"
    Project ||--o{ ProjectMember : "má"
    User {
        uuid id PK
        string email UK
        string passwordHash
        ROLE role
        string firstName
        string lastName
        boolean isActive
        datetime lastLoginAt
        datetime passwordChangedAt
        datetime createdAt
        datetime updatedAt
    }
    Session {
        uuid id PK
        uuid userId FK
        string tokenHash UK
        datetime createdAt
        datetime lastUsedAt
        datetime expiresAt
    }
    Language {
        uuid id PK
        string tag UK
        string englishName
        string nativeName
        string flagCode
        boolean isBase
        datetime createdAt
        datetime updatedAt
    }
    Project {
        uuid id PK
        string name
        string slug UK
        string primaryColor
        boolean protectVariables
        datetime createdAt
        datetime updatedAt
    }
    ProjectMember {
        uuid projectId PK, FK
        uuid userId PK, FK
        datetime createdAt
    }
```

## Migrácie

Migrácie sú v `backend/prisma/migrations/` a commitujú sa do gitu.

| Príkaz (z rootu)  | Čo robí                                                                  |
| ----------------- | ------------------------------------------------------------------------ |
| `pnpm db:migrate` | `prisma migrate dev` (vytvorí a aplikuje migráciu v dev DB) a potom seed |
| `pnpm db:seed`    | iba seed                                                                 |
| `pnpm db:reset`   | zmaže lokálnu DB, aplikuje všetky migrácie a spustí seed                 |

Nová migrácia: zmeň `schema.prisma` a spusti `pnpm --filter backend exec prisma migrate dev --name <nazov>`.

V produkčnom stacku backend pri štarte spustí `prisma migrate deploy`, potom seed a až potom server (`docker/backend-entrypoint.sh`, server spúšťa cez `exec`, aby dostal SIGTERM). Mimo Dockera robí to isté skript `start:prod`.

## Seed

Seed (`backend/prisma/seed.ts`) vytvorí admina `michal.bella@goodrequest.com` s rolou `ADMIN`, jazyky `sk` (základný) a `en` a projekt `B2B Admin`.

- Heslo je z ENV `SEED_ADMIN_PASSWORD` a musí spĺňať pravidlá hesla z `packages/shared` (8 až 128 znakov). Ak chýba alebo je nevalidné, seed skončí s chybou a nič nevytvorí.
- Seed je idempotentný: ak admin s týmto emailom existuje, nemení nič (ani heslo, ani rolu). Zmena `SEED_ADMIN_PASSWORD` v `.env` existujúceho admina neovplyvní. Lokálne sa admin obnoví cez `pnpm db:reset`.
- Jazyky `sk` (základný) a `en` s názvami a vlajkou z katalógu seed vytvorí iba do prázdnej tabuľky `Language`. Ak v nej je aspoň jeden jazyk, nemení nič. Seed beží pri každom štarte backend kontajnera, takže jazyk, ktorý ADMIN odstránil, sa po reštarte neobjaví. Lokálne sa jazyky obnovia cez `pnpm db:reset`.
- Projekt `B2B Admin` so slugom `b2b-admin` (farba a ochrana premenných z defaultov) seed vytvorí iba do prázdnej tabuľky `Project` a jeho jediným členom urobí seedovaného admina. Ak projekt existuje, nemení nič, takže zmeny ADMIN-a v nastaveniach projektu ostanú aj po reštarte.

## Test databáza

Integračné testy bežia voči `locale_test` v tom istom Postgres kontajneri (`TEST_DATABASE_URL`). Ak názov DB nekončí na `_test`, testy sa nespustia. Podrobnosti v [Testovanie](./testing.md).
