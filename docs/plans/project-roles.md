---
title: 'Roly v projekte (Správca, Editor, Návštevník per projekt)'
updated: 2026-10-25
notion_page_id:
---

# Roly v projekte

## Kontext

Dnes je rola globálna (`User.role`: `ADMIN`, `MANAGER`, `EDITOR`, `VISITOR`) a `ProjectMember` je iba dvojica projekt + používateľ. Jeden používateľ preto nemôže byť Správcom v projekte A a Návštevníkom v projekte B. Tento plán presúva rolu **Správca / Editor / Návštevník na členstvo v projekte**. Globálne ostáva iba rozlíšenie, či je používateľ administrátor.

Modelová situácia: projekt A má člena 1 s rolou `MANAGER` (je to „vlastník“ projektu), projekt B má toho istého člena s rolou `VISITOR`.

## Rozhodnutia (potvrdené používateľom 2026-10-25)

| Otázka                                    | Rozhodnutie                                                                                                                          |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Admin                                     | Bez zmeny: vidí všetky projekty bez členstva, zakladá projekty, spravuje používateľov a členov. Nikdy nie je členom (`MEMBER_IS_ADMIN`). |
| Globálna rola                             | Iba administrátor áno / nie. Modál Nový používateľ a detail používateľa nemajú výber Správca / Editor / Návštevník.                     |
| Kto pridáva a odoberá členov, mení im rolu | Iba `ADMIN`, ako dnes. Správca projektu členov nespravuje.                                                                          |
| Vlastník projektu                         | Nie je samostatná rola, predstavuje ho `MANAGER` projektu. Projekt môže mať viac Správcov alebo žiadneho.                            |
| Predvolená rola pri pridaní člena         | `EDITOR`.                                                                                                                            |
| Posledný Správca opustí projekt           | Smie (projekt ostáva prístupný adminom).                                                                                              |
| Migrácia                                  | Každé existujúce členstvo dostane súčasnú globálnu rolu používateľa; správanie sa pre existujúce dáta nezmení.                       |
| Projektové roly Administrator, Translator, Developer, Reviewer | Zrušené. Projektové roly sú iba `MANAGER`, `EDITOR`, `VISITOR`, ďalšie rozšírenie sa neplánuje.                       |

## Predpoklady (potvrdiť pri implementácii)

| Predpoklad                                                                                                     | Prečo                                                                                                 |
| -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `User.role` sa zúži na enum `ADMIN \| USER` (nie boolean `isAdmin`).                                            | Pravidlá `LAST_ADMIN` v `adminUsers.service.ts` a `profile.service.ts` ostanú takmer bez zmeny.         |
| Nový enum `PROJECT_ROLE` (`MANAGER`, `EDITOR`, `VISITOR`) na `ProjectMember.role`, povinný, predvolene `EDITOR`. | Rola existuje iba spolu s členstvom; odobratím člena zmizne aj rola.                                    |
| Efektívna rola v projekte = `ADMIN` pre admina, inak `ProjectMember.role`. Počíta ju jedno miesto na backende.   | Guardy, zámok verzie a služby nečítajú `user.role` priamo, takže sa pravidlá nerozídu.                  |
| Zmena roly admina na `USER` nepridá členstvá; admin ich potom dostane ručne.                                    | Nevieme, do ktorých projektov a s akou rolou by mal patriť.                                            |

## Zmeny

### packages/shared

- `ROLE` = `ADMIN`, `USER`; nový `PROJECT_ROLE` = `MANAGER`, `EDITOR`, `VISITOR`; typ efektívnej roly `ROLE.ADMIN | PROJECT_ROLE`.
- `canManageProject(role)` a `isVisitor` pracujú s efektívnou rolou.
- Kontrakty: `POST …/members` a `POST /api/admin/users/:id/projects` (Pridať do projektu) prijmú `role` (predvolene `EDITOR`); nový `PATCH /api/projects/:projectId/members/:userId` s `{ role }`; `ProjectMember` a projekty používateľa v detaile vrátia `role`; zoznam a detail projektu vrátia `myRole`; `CreateUserRequest`, `UpdateUserRequest`, `UpdateProfileRequest` a `/me` pracujú iba s `ADMIN | USER`.
- Aktivita `MEMBER_ROLE_CHANGED` (payload: používateľ, stará a nová rola).

### Databáza

- Migrácia `project_roles`: enum `PROJECT_ROLE`, stĺpec `ProjectMember.role`, naplnenie z `User.role`, potom `User.role` (`MANAGER`, `EDITOR`, `VISITOR` → `USER`) a zúženie enumu `ROLE`.
- Seed sa nemení: vytvára iba admina a projekt bez členov (testovacích používateľov s heslami do seedu nedávame).

### Backend

- `requireProjectAccess` načíta členstvo s rolou a uloží efektívnu rolu na request; `requireRole` na projektových route nahradí `requireProjectRole(...)` s rovnakými zoznamami rolí ako dnes (`projects.routes.ts`).
- `requireRole(ROLE.ADMIN)` ostáva pre `/api/admin/*`, `POST /projects` a správu členov.
- Efektívnu rolu dostanú aj `projectVersions.ts` (zápis do uzamknutej verzie), `translations.controller.ts` a `imports.controller.ts` namiesto `user.role`.
- `projectMembers.service.ts`: rola pri pridaní, zmena roly (404 pre nečlena, 409 `MEMBER_IS_ADMIN` sa nemení), zoznam členov vracia rolu členstva.
- `projects.service.ts`: `myRole` v zozname a detaile projektu.
- Integračné testy: rovnaký používateľ ako `MANAGER` v jednom a `VISITOR` v druhom projekte (nastavenia, import, zápis do uzamknutej verzie, úprava prekladu); zmena roly iba `ADMIN`; migrácia zachová práva.

### Frontend

- Kontroly rolí na stránkach projektu (Preklady, Prehľad, Jazyky, Verzie, Nastavenia, Členovia), Sidebar a route guardy projektu čítajú `project.myRole`, nie `me.role`; guardy si projekt načítajú v `beforeLoad`.
- Sekcia Správa a jej guardy ostávajú na `me.role === ADMIN`.
- Modál Nový používateľ: namiesto výberu roly prepínač Administrátor.
- Detail používateľa: namiesto výberu roly prepínač Administrátor; tabuľka Projekty má stĺpec Rola s výberom; Pridať do projektu sa pýta aj na rolu.
- Modál Pridať člena: výber roly (predvolene Editor), aj pri Vytvoriť nového používateľa.
- Stránka Členovia: stĺpec Rola, admin ju mení výberom priamo v riadku; ostatní ju iba vidia.
- Tabuľka Používatelia a profil: namiesto roly Administrátor / Používateľ; profil ukáže projekty s rolami.
- Správcovia na Prehľade (`ProjectManagers`) = členovia s rolou projektu `MANAGER`.
- i18n `sk`, `en`, `cs`.

### Dokumentácia

`AGENTS.md` (doména), `docs/overview.md`, `docs/database.md`, `docs/api/*`, `docs/frontend.md`, `docs/changelog.md`, ADR 0008 „Roly v projekte“; odkazy v plánoch `manager-role.md` a `visitor-role.md` na tento plán; editorský onboarding (`docs/onboarding/editor/`) tam, kde spomína rolu.

## Míľniky

1. **Kontrakt + DB + backend** (hotové 2026-10-25): shared, migrácia, guardy, endpointy, integračné testy. Aby prešiel `pnpm verify`, patrí sem aj prepnutie kontrol rolí na frontende na `myRole` (`useProjectRole`, guardy) a Administrátor / Používateľ v modáli Nový používateľ a v profile.
2. **Frontend** (hotové 2026-10-25): výber roly v Pridať člena (aj pri Vytvoriť nového používateľa) a Pridať do projektu, stĺpec Rola so zmenou na stránke Členovia a na detaile používateľa, prepínač Administrátor namiesto výberu roly (nový používateľ, detail, profil admina), sekcia Moje projekty v profile, i18n, unit testy. Overené v prehliadači.
3. **E2E + docs**: E2E pre používateľa s dvomi rolami, smoke `api-smoke`, dokumentácia a ADR.

## Overenie

`pnpm verify`; integračné testy z backendu; v prehliadači používateľ, ktorý je Správca v jednom projekte (vidí Nastavenia, Import) a Návštevník v druhom (iba Preklady a Prehľad, bez úprav); zmena roly na stránke Členovia sa prejaví po obnovení projektu; modál Nový používateľ bez výberu roly.
