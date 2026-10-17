---
title: 'Prehľad'
updated: 2026-10-16
notion_page_id:
---

# Prehľad

Locale Admin je admin aplikácia na správu prekladov pre organizácie a ich projekty.

## Doménové pojmy

| Pojem           | Význam                                                                          |
| --------------- | ------------------------------------------------------------------------------- |
| Organizácia     | zákazník, má viac projektov                                                     |
| Projekt         | jeden prekladový sheet (napr. B2B admin, B2C iOS, B2C Android, web URLs)        |
| Editor          | človek, ktorý upravuje preklady v projektoch                                    |
| Globálna rola   | `ADMIN` (spravuje používateľov a jazyky) alebo `EDITOR`                         |
| Jazyk           | jazyk prekladov z katalógu podporovaných jazykov, práve jeden je základný       |
| Rola v projekte | Administrátor, Prekladateľ, Vývojár, Kontrolór. Príde s projektmi v ďalšej fáze |

Registrácia neexistuje. Používateľov zakladá iba admin na stránke **Používatelia** (`/admin/users`): zadá e-mail a heslo, nový používateľ má vždy rolu `EDITOR`.

Jazyky spravuje iba admin na stránke **Jazyky** (`/languages`): pridá jazyk z katalógu, upraví jeho názvy, vlajku a základný jazyk, alebo ho po potvrdení odstráni. Kým nie sú projekty, je zoznam jazykov globálny.

## Stav

Fáza 1 rieši základ: prihlásenie, správu používateľov a infraštruktúru. Organizácie, projekty a editor prekladov prídu v ďalších fázach.
