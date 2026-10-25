---
title: 'Onboarding pre editorov'
updated: 2026-10-24
notion_page_id:
---

# Onboarding pre editorov

Príručka pre editorov, ktorí v Locale Admin prekladajú texty aplikácií. Hlavná časť je práca s obrazovkou **Preklady**; verzie, história a prehľad projektu sú opísané stručnejšie.

> Koncept na pripomienkovanie. Screenshoty sú z lokálneho prostredia s reálnymi dátami projektov **Web Salon Catalog** (premenné, HTML značky, plurály v ICU formáte) a **B2B admin** (verzie, plurály ako samostatné kľúče). Účet „Jana Nováková“ je demo účet editora.

## Obsah

1. [Úvod: prihlásenie a projekty](./01-uvod.md)
2. [Prehľad](./02-prehlad.md)
3. [Preklady](./03-preklady.md)
4. [Úprava prekladu: premenné, HTML značky, plurály a validácia](./04-uprava-prekladu.md)
5. [Verzie](./05-verzie.md)
6. [História](./06-historia.md)
7. [Jazyky](./07-jazyky.md)
8. [Členovia](./08-clenovia.md)
9. [Nastavenia](./09-nastavenia.md)
10. [Postup práce a časté otázky](./10-postup-a-faq.md)

## Ako z toho vznikne PDF

Kapitoly sú obyčajné Markdown súbory, upravujú sa priamo. PDF sa skladá skriptom:

```bash
node docs/onboarding/editor/_tools/build-pdf.mjs
```

Výsledok je `docs/onboarding/editor/onboarding-editor.pdf`.

Screenshoty sa dajú nasnímať znova z bežiacej aplikácie (`pnpm dev`) účtom editora, ktorý je členom projektov `web-salon-catalog` a `b2b-admin`. Skript nič neukladá, iba otvára obrazovky a modály:

```bash
node docs/onboarding/editor/_tools/screenshots.mjs cesta/k/editor.json
```

`editor.json` obsahuje `{ "email": "…", "password": "…" }` a do repozitára nepatrí. Jednotlivé obrázky sa dajú pretočiť menom scény na konci príkazu (napr. `… editor.json editSimple diff`).
