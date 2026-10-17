---
title: 'Prehľad'
updated: 2026-10-16
notion_page_id:
---

# Prehľad

Locale Admin je admin aplikácia na správu prekladov pre organizácie a ich projekty.

## Doménové pojmy

| Pojem           | Význam                                                                                          |
| --------------- | ----------------------------------------------------------------------------------------------- |
| Organizácia     | zákazník, má viac projektov                                                                     |
| Projekt         | jeden prekladový sheet (napr. B2B admin, B2C iOS, B2C Android, web URLs). Zatiaľ existuje jeden |
| Editor          | človek, ktorý upravuje preklady v projektoch                                                    |
| Globálna rola   | `ADMIN` (spravuje používateľov a jazyky) alebo `EDITOR`                                         |
| Jazyk           | jazyk prekladov z katalógu podporovaných jazykov, práve jeden je základný                       |
| Rola v projekte | Administrátor, Prekladateľ, Vývojár, Kontrolór. Príde s projektmi v ďalšej fáze                 |

Registrácia neexistuje. Používateľov zakladá iba admin na stránke **Používatelia** (`/admin/users`): zadá e-mail a heslo, nový používateľ má vždy rolu `EDITOR`.

Jazyky spravuje iba admin na stránke **Jazyky** (`/languages`): pridá jazyk z katalógu, upraví jeho názvy, vlajku a základný jazyk, alebo ho po potvrdení odstráni. Kým nie sú jazyky naviazané na projekt, je zoznam jazykov globálny.

Nastavenia projektu spravuje iba admin na stránke **Nastavenia projektu** (`/project-settings`): názov, slug, primárnu farbu, základný jazyk a ochranu premenných `{{ variable }}`. Zatiaľ existuje jeden projekt zo seedu, organizácie a viac projektov prídu neskôr.

## Stav

Fáza 1 rieši základ: prihlásenie, správu používateľov a infraštruktúru. Organizácie, viac projektov a editor prekladov prídu v ďalších fázach.
