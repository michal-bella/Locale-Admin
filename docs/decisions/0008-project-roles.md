---
title: '0008: Rola v projekte namiesto globálnej roly člena'
updated: 2026-10-26
notion_page_id:
---

# 0008: Rola v projekte namiesto globálnej roly člena

## Kontext

Rola `MANAGER`, `EDITOR` a `VISITOR` bola globálna (`User.role`) a platila vo všetkých projektoch, kde bol používateľ členom. Admin tak nemohol dať jednému človeku správu projektu A (je jeho „vlastníkom“) a v projekte B mu nechať iba čítanie. Plán: [`project-roles`](../plans/project-roles.md).

Alternatívy:

- **Globálna rola ako predvolená a výnimka na členstve:** zachová súčasné správanie, ale vzniknú dva zdroje pravdy a v UI nie je jasné, odkiaľ rola v projekte pochádza.
- **Samostatná rola Vlastník:** ďalšia úroveň nad Správcom, ktorú používateľ nepotrebuje; vlastníka projektu predstavuje `MANAGER`.
- **Rola iba na členstve** (zvolené): globálne ostáva iba `ADMIN` / `USER`, rola v projekte je `ProjectMember.role`.

## Rozhodnutie

`User.role` je `ADMIN` alebo `USER`. `ProjectMember.role` (enum `PROJECT_ROLE`) je `MANAGER`, `EDITOR` (predvolená) alebo `VISITOR` a nastavuje ju iba `ADMIN` pri pridaní člena a cez `PATCH …/members/:userId`. `ADMIN` ostáva bez členstiev a pracuje vo všetkých projektoch. Backend určuje rolu v projekte na jednom mieste (`requireProjectAccess` → `requireProjectRole`), frontend ju berie z `myRole` v zozname projektov. Migrácia `project_roles` skopírovala globálnu rolu každého člena do jeho členstiev, takže sa existujúce práva nezmenili.

## Dôsledky

- Ten istý používateľ môže mať v každom projekte inú rolu; správu členov má stále iba `ADMIN`.
- Kto sa stane `ADMIN`-om, členstvá s rolami si ponechá; kým je `ADMIN`, nepočítajú sa a po odobratí admina platia znova (predtým sa mazali).
- Modál Nový používateľ a detail používateľa vyberajú iba Administrátor / Používateľ, rola v projekte sa vyberá pri pridaní do projektu.
- Projektové roly Administrator, Translator, Developer, Reviewer z pôvodného zadania sa nerobia.
