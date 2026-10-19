---
title: 'Dokumentácia'
updated: 2026-10-19
notion_page_id:
---

# Dokumentácia

Index projektovej dokumentácie. Zdroj pravdy je tento priečinok v repe, Notion bude iba kópia na čítanie.

| Stránka                                 | Obsah                                            |
| --------------------------------------- | ------------------------------------------------ |
| [Prehľad](./overview.md)                | čo aplikácia robí, doménové pojmy, role          |
| [Architektúra](./architecture.md)       | monorepo, FE ↔ BE ↔ DB, auth flow, Docker služby |
| [API](./api/README.md)                  | endpointy, chybový kontrakt                      |
| [API: preklady](./api/translations.md)  | zoznam prekladov, úprava prekladu v riadku       |
| [API: import](./api/imports.md)         | import CSV: formát, chyby, kontrola a zápis      |
| [Databáza](./database.md)               | dátový model, migrácie, seed                     |
| [Frontend](./frontend.md)               | routing, layout, i18n, Mantine theme             |
| [Lokálny vývoj](./local-development.md) | spustenie, ENV premenné, troubleshooting         |
| [Testovanie](./testing.md)              | typy testov a ako ich spustiť                    |
| [Rozhodnutia](./decisions/README.md)    | architektonické rozhodnutia (ADR)                |
| [Changelog](./changelog.md)             | čo pribudlo v ktorej fáze                        |

Plány fáz sú v [`plans/`](./plans/phase-1.md) (aktuálny: [členovia projektu z existujúcich používateľov](./plans/project-members.md), predchádzajúci: [zobrazenia prekladov a úprava v modále](./plans/translations-views.md)) a do Notionu sa nesynchronizujú.
