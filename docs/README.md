---
title: 'Dokumentácia'
updated: 2026-10-25
notion_page_id:
---

# Dokumentácia

Index projektovej dokumentácie. Zdroj pravdy je tento priečinok v repe, Notion bude iba kópia na čítanie.

| Stránka                                                  | Obsah                                            |
| -------------------------------------------------------- | ------------------------------------------------ |
| [Prehľad](./overview.md)                                 | čo aplikácia robí, doménové pojmy, role          |
| [Architektúra](./architecture.md)                        | monorepo, FE ↔ BE ↔ DB, auth flow, Docker služby |
| [API](./api/README.md)                                   | endpointy, chybový kontrakt                      |
| [API: preklady](./api/translations.md)                   | zoznam prekladov, úprava prekladu a kľúča        |
| [API: import](./api/imports.md)                          | import CSV: formát, chyby, kontrola a zápis      |
| [API: export](./api/exports.md)                          | export CSV: formát, stav, nebezpečné hodnoty     |
| [Databáza](./database.md)                                | dátový model, migrácie, seed                     |
| [Frontend](./frontend.md)                                | routing, layout, i18n, Mantine theme             |
| [Lokálny vývoj](./local-development.md)                  | spustenie, ENV premenné, troubleshooting         |
| [Testovanie](./testing.md)                               | typy testov a ako ich spustiť                    |
| [Rozhodnutia](./decisions/README.md)                     | architektonické rozhodnutia (ADR)                |
| [Onboarding pre editorov](./onboarding/editor/README.md) | príručka pre editorov (Markdown a PDF)           |
| [Changelog](./changelog.md)                              | čo pribudlo v ktorej fáze                        |

Plány fáz sú v [`plans/`](./plans/phase-1.md) (aktuálny: [verzie prekladov projektu](./plans/translation-versions.md), predchádzajúci: [banner upozornení na premenné](./plans/translation-warnings.md)) a do Notionu sa nesynchronizujú.
