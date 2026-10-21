---
title: 'Rola Návštevník (VISITOR) – prvotný plán'
updated: 2026-10-21
notion_page_id:
---

# Rola Návštevník (VISITOR)

## Kontext

Aplikácia má dve globálne role: `ADMIN` (Administrátor) a `EDITOR` (Editor). Tento plán pridáva tretiu, **`VISITOR` (Návštevník)**: člen projektu, ktorý preklady iba **číta, filtruje a exportuje**. Nič neupravuje a nevidí žiadne tlačidlo ani stránku, ktorá vedie k úprave.

Postup podľa `.agents/workflows/feature.md` na vetve `feature/visitor-role`. Po každom míľniku checkpoint (`pnpm verify`, `docs/`, commit, krátky report).

### Požiadavky používateľa

- Návštevník má k dispozícii iba **Preklady** (`/projects/$slug/translations`) a **Prehľad** (`/projects/$slug/dashboard`).
- Všetky CTA prvky sú skryté, vidí iba tlačidlo **Exportovať**.
- Preklad nemôže upraviť ani doplniť: bunka v tabuľke **neotvára** modál „Upraviť preklad“, všetko je read-only.
- Môže **filtrovať** v tabuľke prekladov (vyhľadávanie, stav, namespace, editor, zmenené, zoradenie, zobrazenie, jazyky).
- Rola je dostupná **všade, kde sa dnes vyberá medzi Administrátor a Editor**.

### Predpoklady (potvrdiť)

| Predpoklad                                                                                                                                                                    | Prečo                                                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Návštevník je **člen projektu** (`ProjectMember`) ako Editor: do projektu ho pridá admin na stránke Členovia, inak nevidí nič.                                                 | Prístup k projektu je už dnes členstvo + globálna rola; bez členstva by nemal čo zobraziť.                                      |
| Zoznam projektov `/` a stránka `/profile` **ostávajú** dostupné.                                                                                                              | Bez `/` si nevyberie projekt; na `/profile` si mení meno a heslo. Ak to nie je žiaduce, `/profile` sa dá tiež zablokovať.      |
| Na `/` **nemá** ikonu Opustiť projekt; na Prehľade sú skryté iba odkazy na zakázané stránky (Spravovať jazyky), odkazy na Preklady (Otvoriť preklady, feed aktivity) ostávajú. | „Všetky CTA skryté“ čítame ako „nič, čo mení dáta alebo vedie na zakázanú stránku“. Ak majú zmiznúť aj odkazy na Preklady, je to jedna podmienka navyše. |
| Prepínanie zobrazenia (rozšírené / kompaktné, stĺpce / pod sebou) ostáva povolené.                                                                                            | Je to preferencia účtu, nie zmena prekladov; patrí k filtrovaniu.                                                               |
| Posledný `ADMIN` sa nemôže stať Návštevníkom (rovnaké pravidlo ako pri Editorovi).                                                                                            | Kontrola `role !== ROLE.ADMIN` v `adminUsers.service.ts` a `profile.service.ts` to už pokrýva.                                  |

### Rozsah

| Prvok                                                                                          | Návštevník                                       |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Preklady: štatistiky, filtre, zobrazenie, stránkovanie, Exportovať                             | áno                                              |
| Preklady: Pridať kľúč, Importovať, úprava kľúča (ceruzka v riadku), modál Upraviť preklad     | nie (skryté, bunka je text)                      |
| Prehľad: karty, stav jazykov, aktivita, graf                                                   | áno (iba čítanie)                                |
| Prehľad: odkaz Spravovať jazyky                                                                | nie                                              |
| Nastavenia projektu, Jazyky, Členovia (stránky aj položky v sidebare)                          | nie (403 v aplikácii, 403 z API)                 |
| Zoznam projektov `/`, Opustiť projekt                                                          | zoznam áno, opustiť nie                          |
| Správa (`/admin/*`)                                                                            | nie (ako Editor)                                 |
| Rola v projekte (Administrátor, Prekladateľ, …)                                                | nemení sa, stále neexistuje                      |

## Dátový model (nová migrácia)

```prisma
enum ROLE {
  ADMIN
  EDITOR
  VISITOR
}
```

Migrácia je jeden príkaz `ALTER TYPE "ROLE" ADD VALUE 'VISITOR';`. Postgres (≥ 12) ho dovolí v transakcii, pokiaľ sa nová hodnota v tej istej transakcii nepoužije; migrácia ju nepoužíva, takže `prisma migrate dev` aj `prisma migrate deploy` prejdú bez úprav. Seed sa nemení (zakladá iba admina).

## Kontrakt (`packages/shared`)

| Súbor               | Zmena                                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `auth.ts`           | `ROLE.VISITOR = 'VISITOR'` + JSDoc: čo rola smie. Všetky schémy s `z.enum(ROLE)` (`authUserSchema`, `createUserRequestSchema`, `updateUserRequestSchema`, `adminUserSchema`, `projectMemberSchema`, profil) ju dostanú automaticky. |
| `adminUsers.test.ts`, `projects.test.ts`, `profile.test.ts` | prípad: `VISITOR` prejde validáciou.                                                                     |

Nový error code netreba: zakázané akcie vracajú existujúce `FORBIDDEN` (403).

## Backend

| Miesto                                   | Zmena                                                                                                                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prisma/schema.prisma` + migrácia        | hodnota enumu (vyššie).                                                                                                                                 |
| `lib/authUser.ts`                        | `ROLE_FROM_PRISMA` a `ROLE_TO_PRISMA` o `VISITOR` (typ `Record<…>` to vynúti pri typecheck-u).                                                          |
| `routes/projects.routes.ts`              | `PUT /:projectId/keys/:keyId/translations/:languageId` dostane `requireRole(ROLE.ADMIN, ROLE.EDITOR)`; to isté `DELETE /:projectId/membership` (Opustiť projekt). Ostatné mutácie už majú `requireRole(ROLE.ADMIN)`. GET endpointy (settings, languages, members, dashboard, activity, translations, export, export/check) ostávajú pre každého člena – Prehľad a Preklady ich potrebujú. |
| `services/projects.service.ts`           | bez zmeny: `visibleProjects` a `hasProjectAccess` rozlišujú iba `ADMIN` vs. ostatní (členstvo).                                                         |
| `services/adminUsers.service.ts`, `profile.service.ts` | bez zmeny logiky; integračný test, že posledný admin sa nemôže stať `VISITOR`.                                                               |
| Integračné testy                         | `translations`: `VISITOR` člen dostane 403 na PUT prekladu a 200 na GET/export; `projects`: 403 na opustenie projektu; `adminUsers`: vytvorenie a zmena roly na `VISITOR`. |

Otvorené: `GET /:projectId/settings` a `GET /:projectId/languages` ostávajú návštevníkovi dostupné, lebo ich načítava route projektu a stránka Preklady (jazyky). Blokovanie stránok Nastavenia / Jazyky / Členovia je preto iba vo FE guardoch; API tam nič nemení, takže je to bezpečné.

## Frontend

### Route guardy (`frontend/src/routes`)

| Route                                                             | Zmena                                                                                           |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `projectSettingsRoute.ts`, `projectLanguagesRoute.ts`, `projectMembersRoute.ts` | `beforeLoad`: `context.user.role === ROLE.VISITOR` → `throw new ForbiddenError()` + eager `errorComponent: RouteError` (vzor `adminUsersRoute.ts`). |
| `guards.test.tsx`                                                 | prípady: návštevník vidí Preklady a Prehľad, dostane 403 na settings / languages / members a na `/admin/*`. |

### Komponenty a stránky

| Súbor                                                | Zmena                                                                                                                                                                         |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pages/TranslationsPage/TranslationsPage.tsx`        | `canEdit = role !== VISITOR`; `onSave` do tabuľky iba keď `canEdit`. Pridať kľúč a Importovať sú už `isAdmin`.                                                                 |
| `components/TranslationsTable/TranslationsTable.tsx` | nový prop `readOnly`: bunky bez `onClick`, `EditTranslationModal` sa nerenderuje, prázdny stav s textom pre editora (bez Importovať – už dnes).                              |
| `components/TranslationCell/TranslationCell.tsx`     | bez `onClick` renderuje `div` namiesto `button` (a11y: nič neklikateľné, žiadny falošný fokus). Pozor na `classes.button` – hover a kurzor iba pre tlačidlo.                   |
| `components/Sidebar/Sidebar.tsx`                     | v projekte návštevník vidí iba Preklady a Prehľad (`canManageProject = role !== VISITOR`). Sekcia SPRÁVA je už `isAdmin`.                                                     |
| `pages/DashboardPage` + `components/LanguageStatus`  | odkaz Spravovať jazyky iba pre `role !== VISITOR`; Otvoriť preklady a odkazy vo feede ostávajú (predpoklad vyššie).                                                            |
| `components/ProjectsList/ProjectsList.tsx`           | ikona Opustiť projekt skrytá pre návštevníka.                                                                                                                                  |
| `components/CreateUserModal/CreateUserModal.tsx`     | tretia možnosť `VISITOR` v rádiu (riadky 147–148 dnes vypisujú role ručne; prejsť na `Object.values(ROLE)` ako v `UserCard`).                                                 |
| `components/UserCard/UserCard.tsx`, `PersonalDetailsSection` | bez zmeny kódu: `Object.values(ROLE)` nový select automaticky ponúkne. Overiť v teste.                                                                                 |
| `components/AddMemberModal/AddMemberModal.tsx`       | bez zmeny (`defaultRole` ostáva `EDITOR`); vytvorenie používateľa z modálu ponúkne aj Návštevníka cez `CreateUserModal`.                                                       |
| `components/RoleBadge/RoleBadge.tsx`                 | `VISITOR` má tlmený štýl ako Editor (nie brand tint). Zvážiť tretí odtieň, ak má byť v tabuľkách rozlíšiteľný na prvý pohľad.                                                 |
| `components/MembersTable`, `UsersTable`              | bez zmeny: badge sa vykreslí z `user.role`. Pridať test na zobrazenie.                                                                                                        |
| `pages/ProjectSettingsPage`, `ProjectLanguagesPage`, `MembersPage` | bez zmeny: návštevník sa na ne nedostane (guard).                                                                                                                |
| `test/mockApi.ts`                                    | `MOCK_VISITOR` pre testy stránok.                                                                                                                                             |

Pomocník: namiesto rozťahovania `isAdmin` checkov pridať do `@locale/shared` (alebo `frontend/src/lib`) `canEditTranslations(role)` / `canManageProject(role)`, aby sa pravidlo „kto smie čo“ nepísalo na piatich miestach. Rozhodnúť pri implementácii; pre dve funkcie je to ešte únosné aj inline.

### i18n (`sk`, `en`, `cs`)

| Kľúč                                          | sk                                                                          |
| --------------------------------------------- | --------------------------------------------------------------------------- |
| `roles.VISITOR`                               | Návštevník                                                                  |
| `usersPage.createModal.role.description.VISITOR` | Iba číta a exportuje preklady v projektoch, do ktorých ho pridá administrátor. |

Existujúce texty `…emptyEditor`, `languagesPage.descriptionEditor` a `projectsPage.list.emptyEditor` sú pre „nie admin“, návštevníkovi vyhovujú.

## E2E (`e2e/`)

| Súbor                | Zmena                                                                                                                                              |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `support/api.ts`     | `Role` o `'VISITOR'`.                                                                                                                              |
| `support/users.ts`   | `createVisitor` (ako `createEditor`: nový projekt + používateľ `VISITOR` + členstvo).                                                             |
| nový `visitor.spec.ts` | návštevník: sidebar má iba Preklady a Prehľad; na Prekladoch vidí iba Exportovať, bunka nie je tlačidlo, filtrovanie funguje; `/settings`, `/languages`, `/members` → 403; API PUT prekladu → 403; export → 200. |
| `admin-projects.spec.ts` / `user-detail.spec.ts` | vytvorenie používateľa s rolou Návštevník, zmena roly v detaile.                                                                           |

## Dokumentácia (`docs/`)

- `overview.md`: tabuľka pojmov (Globálna rola: `ADMIN`, `EDITOR`, `VISITOR`), odsek o stránkach projektu.
- `api/admin-users.md`, `api/profile.md`, `api/projects.md`, `api/translations.md`: enum roly a 403 pre `VISITOR` pri úprave prekladu a opustení projektu.
- `database.md`: enum `ROLE`.
- `frontend.md`: guardy projektových stránok.
- `changelog.md`.
- `AGENTS.md`: pojem Member/Global role, odkaz na tento plán ako „Current plan“.

## Míľniky

| #  | Obsah                                                                                                            | Overenie                                                                   |
| -- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| A  | Kontrakt + DB: `ROLE.VISITOR` v shared, Prisma enum + migrácia, `authUser.ts`, shared a integračné testy, i18n `roles.VISITOR` a popis roly (typované kľúče ich vyžadujú hneď) | `pnpm verify`; admin vytvorí používateľa `VISITOR` cez API (api-smoke)     |
| B  | BE: `requireRole` na PUT prekladu a opustenie projektu, integračné testy                                         | `pnpm test:integration`; smoke: `VISITOR` PUT → 403, GET/export → 200     |
| C  | FE výber roly: `CreateUserModal` (rádio), `RoleBadge`, testy; `UserCard` / profil už Návštevníka ponúkajú        | `pnpm verify`; v UI vytvoriť Návštevníka a pridať ho do projektu          |
| D  | FE obmedzenia: guardy, sidebar, read-only tabuľka, Prehľad bez Spravovať jazyky, `/` bez Opustiť, unit testy    | `pnpm verify`; prihlásenie ako Návštevník v `pnpm dev`                     |
| E  | E2E `visitor.spec.ts`, a11y review (bunka ako text), docs, changelog                                             | `pnpm test:e2e`, `tests/accessibility.spec.ts`                             |

## Otvorené otázky

1. Majú na Prehľade zmiznúť aj odkazy vedúce na Preklady (Otvoriť preklady, odkazy vo feede), alebo iba Spravovať jazyky?
2. Ostáva návštevníkovi `/profile` (meno, heslo)?
3. Má mať `RoleBadge` pre Návštevníka vlastný odtieň, alebo stačí tlmený ako Editor?
4. Chceme generický pomocník `canEditTranslations(role)` v shared už teraz, alebo až keď pribudnú projektové role?
