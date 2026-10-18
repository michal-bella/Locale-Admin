---
title: 'Prehľad'
updated: 2026-10-18
notion_page_id:
---

# Prehľad

Locale Admin je admin aplikácia na správu prekladov v projektoch. Organizácie nie sú: používateľ (člen) spravuje svoje projekty sám.

## Doménové pojmy

| Pojem           | Význam                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------- |
| Člen            | používateľ s globálnou rolou `EDITOR`, vidí a spravuje iba projekty, v ktorých je členom          |
| Projekt         | jeden prekladový sheet (napr. B2B admin, B2C iOS, B2C Android, web URLs)                          |
| Editor          | človek, ktorý upravuje preklady v projektoch                                                      |
| Globálna rola   | `ADMIN` (vidí všetky projekty, spravuje adminov a jazyky) alebo `EDITOR` (člen)                   |
| Jazyk           | jazyk prekladov z katalógu podporovaných jazykov, práve jeden je základný                         |
| Rola v projekte | Administrátor, Prekladateľ, Vývojár, Kontrolór. Zatiaľ nie sú, všetci členovia majú rovnaké práva |

Registrácia neexistuje. Po prihlásení je na úvodnej stránke (`/`) **zoznam projektov** bez sidebaru: člen vidí projekty, v ktorých je členom, admin všetky. Odtiaľ sa dá vytvoriť projekt (tvorca sa stane členom), opustiť projekt (posledný člen nemôže) a otvoriť projekt.

V projekte (`/projects/$projectId`, so sidebarom) sú **Nastavenia projektu** (názov, slug, primárna farba, ochrana premenných `{{ variable }}` a základný jazyk, ktorý mení iba admin) a **Členovia**, kde admin aj člen vytvorí nového člena (e-mail a heslo, rola `EDITOR`).

Admin má navyše **Používatelia** (`/admin/users`), kde vidí a vytvára iba administrátorov, a **Jazyky** (`/languages`): pridá jazyk z katalógu, upraví jeho názvy, vlajku a základný jazyk, alebo ho po potvrdení odstráni. Kým nie sú jazyky naviazané na projekt, je zoznam jazykov globálny.

## Stav

Fáza 1 riešila základ: prihlásenie, správu používateľov a infraštruktúru. Po nej pribudli Môj profil, Jazyky, Nastavenia projektu a projekty s členmi. Projektové role a editor prekladov prídu v ďalších fázach.
