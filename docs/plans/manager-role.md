---
title: 'Rola Správca (MANAGER) a admin bez členstva'
updated: 2026-10-25
notion_page_id:
---

# Rola Správca (MANAGER) a admin bez členstva

## Kontext

Aplikácia mala globálne role `ADMIN`, `EDITOR` a `VISITOR`. Tento plán pridáva **`MANAGER` (Správca)**: robí v projekte to isté ako admin, ale nemá sekciu Správa (Projekty, Používatelia). Zároveň `ADMIN` prestáva byť členom projektov: má prístup ku všetkým bez pridávania. Ďalšie práva Správcu dodá používateľ neskôr.

## Rozhodnutia (potvrdené používateľom 2026-10-25)

| Otázka                                    | Rozhodnutie                                                                                                                  |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Ktoré projekty vidí Správca               | Iba tie, do ktorých ho pridá admin (ako Editor).                                                                             |
| Vytvára Správca projekty, spravuje členov | Nie. „Nový projekt“, „Pridať člena“ a odobratie člena ostávajú iba pre `ADMIN`.                                              |
| Admin v projekte                          | Nie je členom (`ProjectMember`), na stránke Členovia sa nezobrazuje, v modáli Pridať člena sa nedá vybrať. Prístup má všade. |
| Pravidlo posledného člena (`LAST_MEMBER`) | Zrušené: projekt bez členov ostáva prístupný adminom.                                                                         |

## Zmeny

- `packages/shared`: `ROLE.MANAGER`, helper `canManageProject(role)` (`ADMIN` alebo `MANAGER`), chybový kód `MEMBER_IS_ADMIN` namiesto `LAST_MEMBER`.
- DB: migrácia `add_manager_role` pridá hodnotu enumu a zmaže členstvá adminov.
- Backend: projektové route s `requireRole(ADMIN)` pustia aj `MANAGER` okrem `POST /projects` a `POST`/`DELETE …/members`; zámok verzie a premenovanie kľúča cez `canManageProject`; `createProject` nepridá tvorcu ako člena; `POST …/members` s adminom vráti 409 `MEMBER_IS_ADMIN`; zmena roly na `ADMIN` zmaže členstvá; seed projekt je bez členov.
- Frontend: pole Rola v modáli Nový používateľ je `Select` so 4 rolami; stránky projektu (Preklady, Jazyky, Verzie, Nastavenia) používajú `canManageProject`; Správa a jej guardy ostávajú iba pre `ADMIN`; modál Pridať člena neponúka adminov; detail admina namiesto projektov ukáže text, tabuľka Používatelia **Všetky**; `RoleBadge` Správcu v tóne admina.

## Overenie

`pnpm verify`, integračné testy pre `MANAGER` (nastavenia, uzamknutá verzia, premenovanie kľúča, 403 na členov, projekty a `/api/admin/*`), `MEMBER_IS_ADMIN`, opustenie posledným členom; v prehliadači modál Nový používateľ, Členovia b2b-admin bez adminov a detail admina.
