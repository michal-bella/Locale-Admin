---
title: 'Prehľad'
updated: 2026-10-19
notion_page_id:
---

# Prehľad

Locale Admin je admin aplikácia na správu prekladov v projektoch. Organizácie nie sú: používateľ (člen) spravuje svoje projekty sám.

## Doménové pojmy

| Pojem           | Význam                                                                                                                                                                                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Člen            | používateľ s globálnou rolou `EDITOR`, vidí a spravuje iba projekty, v ktorých je členom                                                                                                                                                                                 |
| Projekt         | jeden prekladový sheet (napr. B2B admin, B2C iOS, B2C Android, web URLs)                                                                                                                                                                                                 |
| Editor          | človek, ktorý upravuje preklady v projektoch                                                                                                                                                                                                                             |
| Globálna rola   | `ADMIN` (vidí všetky projekty, spravuje používateľov a členov projektov) alebo `EDITOR` (člen)                                                                                                                                                                           |
| Jazyk           | jazyk prekladov projektu z katalógu podporovaných jazykov, v projekte práve jeden je základný                                                                                                                                                                            |
| Kľúč            | prekladový kľúč projektu, unikátny v rámci projektu a namespace, najviac 2 000 bajtov v UTF-8; kľúč v tvare cesty (`orders.empty.title`) sa zoskupuje podľa prefixu, kľúč s medzerami je veta a podľa bodky sa nedelí                                                    |
| Namespace       | názov JSON súboru, z ktorého kľúč pochádza (`loc`, `paths`, …, v CSV sekcia `--loc--`), najviac 100 znakov; pre export sa zachováva presne, v zozname slúži ako skupina a filter                                                                                         |
| Preklad         | text kľúča v jednom jazyku projektu; prázdny (`null`) alebo chýbajúci = Nepreložené, inak Preložené (automaticky schválené). Stav sa neukladá, odvodzuje sa z hodnoty; `""` sa ukladá ako `null`. Kľúč (riadok) je Preložený, až keď má hodnotu v každom jazyku projektu |
| Import          | nahratie CSV súboru (formát `i18nextJsonToCsv`) do projektu v dvoch krokoch: kontrola (jazyky, chyby, zmeny) a zápis. Vyplnená hodnota zo súboru prepíše preklad v projekte, prázdna ho nikdy nezmaže                                                                    |
| Rola v projekte | Administrátor, Prekladateľ, Vývojár, Kontrolór. Zatiaľ nie sú, všetci členovia majú rovnaké práva                                                                                                                                                                        |

Registrácia neexistuje. Po prihlásení je na úvodnej stránke (`/`) **zoznam projektov** bez sidebaru: člen vidí projekty, v ktorých je členom, admin všetky. Odtiaľ admin vytvorí projekt (stane sa jeho členom), každý môže opustiť projekt (posledný člen nemôže) a otvoriť projekt.

Pri vytvorení projektu sa vyberú jeho jazyky z katalógu (aspoň jeden, prvý je základný). V projekte (`/projects/<slug>`, so sidebarom) sú **Preklady** (prvá položka a predvolená stránka projektu: kľúče so všetkými jazykmi projektu vedľa seba (rozšírené zobrazenie, predvolené) alebo so zdrojovým a cieľovým textom (kompaktné zobrazenie; voľba sa ukladá na účet používateľa), stav, vyhľadávanie, filtre a štatistiky, úprava prekladu v modáli po kliknutí na bunku a tlačidlo **Importovať**, ktoré otvorí import CSV), **Nastavenia projektu** (názov, slug, primárna farba, ochrana premenných `{{ variable }}`, ktorá pri úprave prekladu odmietne text s inými premennými ako základný jazyk, a základný jazyk projektu), **Jazyky** (zoznam jazykov projektu, pridanie z katalógu a odobratie okrem základného) a **Členovia**, kde admin pridá existujúceho používateľa do projektu alebo ho z neho odoberie (člen zoznam iba vidí). Používateľov (adminov aj členov) zakladá admin s interným heslom na stránke **Používatelia**; pozvánky emailom nie sú.

Admin má navyše **Používatelia** (`/admin/users`), kde vidí všetkých používateľov, vytvára ich s rolou Administrátor alebo Člen a odstraňuje ich. Globálna stránka jazykov už nie je, jazyky patria projektom.

## Stav

Fáza 1 riešila základ: prihlásenie, správu používateľov a infraštruktúru. Po nej pribudli Môj profil, Jazyky, Nastavenia projektu a projekty s členmi. Preklady sú hotové v rozsahu plánu [`plans/translations-import.md`](./plans/translations-import.md): zoznam prekladov s filtrami, štatistikami a zoskupením, import CSV v dvoch krokoch (kontrola súboru s chybami po riadkoch, priradenie stĺpcov k jazykom, pridanie chýbajúceho jazyka, zápis) a úprava prekladu priamo v riadku s ochranou premenných.

Mimo rozsahu zatiaľ ostávajú: export, formáty JSON a XLSX, stav „Na kontrolu“ (stavy sú iba Preložené a Nepreložené), história importov, mazanie kľúčov, ktoré v súbore chýbajú, prehľad projektu (Overview) a projektové role.
