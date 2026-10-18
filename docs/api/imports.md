---
title: 'API: import prekladov'
updated: 2026-10-18
notion_page_id:
---

# Import prekladov (`/api/projects/:projectId/imports`)

Import súboru s prekladmi do projektu. Najprv kontrola (preview), ktorá nič nezapisuje, potom samotný import (pribudne v ďalšom kroku). Schémy sú v `packages/shared/src/imports.ts`, plán v `docs/plans/translations-import.md`.

| Metóda | Cesta                                      | Prístup            | Popis                                                           |
| ------ | ------------------------------------------ | ------------------ | --------------------------------------------------------------- |
| `POST` | `/api/projects/:projectId/imports/preview` | člen alebo `ADMIN` | analýza súboru: jazyky, kľúče, zmeny, upozornenia; nič nezapíše |

Prístup rieši `requireProjectAccess` rovnako ako ostatné cesty projektu: bez session 401 `AUTH_UNAUTHENTICATED`, mimo prístupu 404 `NOT_FOUND` (viď [projekty](./projects.md#prístup-k-projektu)). Požiadavka prechádza CSRF kontrolou (`Content-Type: application/json` a `X-Requested-With: XMLHttpRequest`).

## Formát CSV

Zatiaľ jediný podporovaný formát. Je to výstup nástroja GoodRequest `i18nextJsonToCsv` (`npx convert-json-to-csv`) zo súborov `public/locales/<tag>/<namespace>.json`. Nie je to RFC 4180: nepoužíva úvodzovky ani escapovanie.

```text
Keys; cs ; en ; sk
--common--
 Uložiť; Uložit; Save; Uložiť
 Máte {{ count }} položiek; Máte {{count}} položek; You have {{ count }} items; Máte {{ count }} položiek
 Prečítajte si <a href="/podmienky">podmienky</a>.; null; Read the <a href="/terms">terms</a>.; Prečítajte si <a href="/podmienky">podmienky</a>.

--routes--
 Uložiť; ""; ""; /ulozit
```

- **Kódovanie** UTF-8. Úvodný BOM sa ticho odstráni. Konce riadkov `\n`, `\r\n` aj `\r` (aj zmiešané).
- **Hlavička** je prvý neprázdny riadok (riadok 1). Delí sa podľa `; ` rovnako ako dátové riadky, každé pole sa oreže (`Keys;en` bez medzier je `HEADER_INVALID`). Prvý stĺpec musí byť presne `Keys` (veľké K), potom aspoň jeden tag jazyka. Stĺpce sa číslujú od 1, prvý jazyk je stĺpec 2.
- **Dátový riadok** sa delí podľa `; ` (bodkočiarka a medzera), každé pole sa oreže (aj úvodná medzera riadku). Prvé pole je kľúč, ďalšie sú hodnoty v poradí stĺpcov hlavičky. Hodnota s `; ` vnútri riadok rozbije (`ROW_COLUMN_COUNT`). Ak riadku chýba presne jedno pole a končí `;` (editor odstránil koncovú medzeru za prázdnym posledným poľom), posledné pole je prázdne, teda `null`. Inak `;` na konci patrí k hodnote (napr. `&nbsp;`).
- **Sekcia** `--názov--` nastaví namespace (názov JSON súboru) pre nasledujúce riadky. Riadky pred prvou sekciou majú prázdny namespace `""`. Povolený názov: `^[A-Za-z0-9._-]+$`, nie `.` ani `..` (pri exporte z neho vznikne názov súboru).
- **Nepreložené**: doslovné `null`, `""` (dve úvodzovky) aj prázdne pole sa načítajú ako `null` (rozhodnutie 1 v pláne).
- **Prázdne riadky** sa preskočia, čísla riadkov v chybách sa počítajú podľa pôvodného súboru (vrátane prázdnych riadkov).
- Ten istý kľúč v dvoch rôznych namespace je v poriadku, v jednom namespace je chyba.
- Hodnoty sa neinterpretujú: HTML (`<a>`, `<strong>`) aj premenné `{{ x }}` ostávajú ako text.

## Chyby súboru (import sa zablokuje)

Odpoveď 422 `IMPORT_FILE_INVALID`, `details` je `{ issues, total }`: prvých 50 chýb (`IMPORT_ISSUES_MAX`) v poradí súboru a celkový počet. Každá chyba má `code`, voliteľne `line` a `column` (od 1) a `params`. Frontend zobrazí preložený `code` s `params`, nikdy text zo servera.

| `code`                 | Kedy                                                                                                     | `line` / `column`       | `params`                        |
| ---------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------- | ------------------------------- |
| `FILE_EMPTY`           | prázdny súbor, iba medzery, iba hlavička (aj so sekciami) bez jediného dátového riadku                   | –                       | –                               |
| `FILE_NOT_UTF8`        | riadok obsahuje znak `U+FFFD` (stopa po neplatnom UTF-8) alebo osamelú UTF-16 náhradu; každý taký riadok | riadok                  | –                               |
| `HEADER_INVALID`       | prvý stĺpec hlavičky nie je `Keys` alebo hlavička nemá žiadny jazyk                                      | riadok hlavičky, 1      | –                               |
| `HEADER_EMPTY_TAG`     | prázdny názov stĺpca jazyka                                                                              | riadok hlavičky, stĺpec | –                               |
| `HEADER_DUPLICATE_TAG` | ten istý tag dvakrát (bez ohľadu na veľkosť písmen)                                                      | riadok hlavičky, stĺpec | `tag`, `firstColumn`            |
| `ROW_COLUMN_COUNT`     | riadok má iný počet polí ako hlavička (typicky `; ` vnútri textu)                                        | riadok                  | `expected`, `actual`            |
| `ROW_EMPTY_KEY`        | prázdny kľúč                                                                                             | riadok, 1               | –                               |
| `ROW_DUPLICATE_KEY`    | kľúč druhýkrát v tom istom namespace (hlási sa druhý výskyt)                                             | riadok, 1               | `key`, `namespace`, `firstLine` |
| `KEY_TOO_LONG`         | kľúč nad 2 000 znakov (`IMPORT_KEY_MAX_LENGTH`, počítajú sa Unicode znaky, emoji = 1)                    | riadok, 1               | `max`, `length`                 |
| `NAMESPACE_INVALID`    | sekcia `----` (prázdny názov) alebo názov mimo `^[A-Za-z0-9._-]+$`, prípadne `.` / `..`                  | riadok                  | `namespace`                     |

Pri `FILE_NOT_UTF8` sa ďalej nekontroluje nič (súbor je pravdepodobne v inom kódovaní). Chyby hlavičky zastavia kontrolu riadkov, lebo bez hlavičky sa riadky nedajú interpretovať.

## Upozornenia (import sa dá dokončiť)

Vracia ich preview v `warnings` (max. 1 000, `IMPORT_WARNINGS_MAX`, v poradí súboru) a `warningsTotal` (celkový počet).

| `code`                       | Kedy                                                                                                                                                                                                                                      | `line` / `column`       | `params`                                      |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | --------------------------------------------- |
| `LANGUAGE_NOT_IN_PROJECT`    | tag je v katalógu `SUPPORTED_LANGUAGES`, ale projekt ho nemá                                                                                                                                                                              | riadok hlavičky, stĺpec | `tag`                                         |
| `LANGUAGE_UNKNOWN`           | tag nie je ani v projekte, ani v katalógu (napr. `pl`)                                                                                                                                                                                    | riadok hlavičky, stĺpec | `tag`                                         |
| `PLACEHOLDER_MISMATCH`       | množina premenných `{{…}}` v hodnote sa líši od hodnoty v stĺpci základného jazyka projektu; premenná sa normalizuje: bez medzier, bez úvodného `-` a bez časti od `,` (`{{ count }}`, `{{- count}}` a `{{count, number}}` = `{{count}}`) | riadok, stĺpec          | `tag`, `key`, `namespace`, `missing`, `extra` |
| `BASE_LANGUAGE_UNTRANSLATED` | hodnota v stĺpci základného jazyka projektu je `null`                                                                                                                                                                                     | riadok, stĺpec          | `tag`, `key`, `namespace`                     |

- `missing` sú premenné zo základného jazyka, ktoré v hodnote chýbajú, `extra` premenné navyše; obe ako text spojený `, ` (napr. `{{count}}, {{name}}`), prázdny reťazec ak nie sú.
- `PLACEHOLDER_MISMATCH` a `BASE_LANGUAGE_UNTRANSLATED` sa kontrolujú iba vtedy, keď súbor obsahuje stĺpec základného jazyka projektu. Premenné sa porovnávajú pre každý ostatný stĺpec (aj `CATALOG` a `UNKNOWN`), iba ak sú obe hodnoty vyplnené.

## POST /api/projects/:projectId/imports/preview

Analyzuje súbor a porovná ho s projektom. **Nič nezapisuje.** Frontend drží súbor v pamäti a pri importe ho pošle znova.

### Telo požiadavky

Schéma `importPreviewRequestSchema`.

| Pole       | Typ    | Povinný | Popis                                             |
| ---------- | ------ | ------- | ------------------------------------------------- |
| `fileName` | string | áno     | názov súboru, 1 až 255 znakov, musí končiť `.csv` |
| `content`  | string | áno     | obsah súboru ako text, max. 10 MB v UTF-8 bajtoch |

### Párovanie

- **Stĺpce**: tag sa porovná bez ohľadu na veľkosť písmen s jazykmi projektu (`PROJECT`, s `languageId`), potom s katalógom (`CATALOG`), inak `UNKNOWN`. V odpovedi je tag tak, ako je v súbore.
- **Kľúče**: podľa dvojice `(namespace, kľúč)`, presná zhoda.
- **Zmeny** sa počítajú iba pre stĺpce `PROJECT`, hodnota v projekte je `null` aj vtedy, keď riadok prekladu chýba:

| Počet             | Súbor    | Projekt                    |
| ----------------- | -------- | -------------------------- |
| `new`             | vyplnený | prázdny alebo kľúč chýba   |
| `changed`         | vyplnený | vyplnený, iná hodnota      |
| `unchanged`       | vyplnený | vyplnený, rovnaká hodnota  |
| `unchanged`       | prázdny  | prázdny alebo kľúč chýba   |
| `keptBecauseNull` | prázdny  | vyplnený (import ho nechá) |

### Odpoveď 200

Schéma `importPreviewResponseSchema`.

| Pole            | Typ    | Popis                                                                                                                                                 |
| --------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `columns`       | pole   | stĺpce jazykov v poradí súboru: `tag`, `columnIndex` (od 2), `match`, `languageId` (iba `PROJECT`), `stats: { translations, untranslated, warnings }` |
| `keys`          | objekt | `{ total, new, existing }` – kľúče zo súboru, nové a už existujúce v projekte                                                                         |
| `namespaces`    | pole   | `{ namespace, keys }` v poradí súboru                                                                                                                 |
| `changes`       | pole   | pre každý stĺpec `PROJECT`: `{ tag, columnIndex, new, changed, unchanged, keptBecauseNull }`                                                          |
| `warnings`      | pole   | upozornenia (viď vyššie), max. 1 000                                                                                                                  |
| `warningsTotal` | číslo  | celkový počet upozornení                                                                                                                              |

`stats.translations` počíta vyplnené hodnoty, `stats.untranslated` hodnoty `null` (aj `""`), `stats.warnings` upozornenia `PLACEHOLDER_MISMATCH` a `BASE_LANGUAGE_UNTRANSLATED` v tomto stĺpci (upozornenie na jazyk sa nepočíta, ten je v `match`).

```json
{
	"columns": [
		{ "tag": "sk", "columnIndex": 2, "match": "PROJECT", "languageId": "0b5e…", "stats": { "translations": 5, "untranslated": 1, "warnings": 1 } },
		{ "tag": "de-AT", "columnIndex": 3, "match": "CATALOG", "stats": { "translations": 2, "untranslated": 4, "warnings": 0 } }
	],
	"keys": { "total": 6, "new": 2, "existing": 4 },
	"namespaces": [
		{ "namespace": "common", "keys": 4 },
		{ "namespace": "routes", "keys": 2 }
	],
	"changes": [{ "tag": "sk", "columnIndex": 2, "new": 3, "changed": 0, "unchanged": 3, "keptBecauseNull": 0 }],
	"warnings": [
		{ "code": "LANGUAGE_NOT_IN_PROJECT", "line": 1, "column": 3, "params": { "tag": "de-AT" } },
		{ "code": "BASE_LANGUAGE_UNTRANSLATED", "line": 6, "column": 2, "params": { "tag": "sk", "key": "Nový kľúč", "namespace": "common" } }
	],
	"warningsTotal": 2
}
```

### Chyby

| HTTP | `code`                  | Kedy                                                                              |
| ---- | ----------------------- | --------------------------------------------------------------------------------- |
| 400  | `VALIDATION_ERROR`      | chýba `fileName` alebo `content`, `fileName` nekončí `.csv`; `details` podľa poľa |
| 401  | `AUTH_UNAUTHENTICATED`  | bez session                                                                       |
| 403  | `CSRF_REJECTED`         | bez `Content-Type: application/json` alebo `X-Requested-With`                     |
| 404  | `NOT_FOUND`             | projekt mimo prístupu (aj neexistujúci alebo ID nie je UUID)                      |
| 413  | `IMPORT_FILE_TOO_LARGE` | `content` má viac ako 10 MB v UTF-8, alebo celé telo požiadavky viac ako 12 MB    |
| 422  | `IMPORT_FILE_INVALID`   | chyby súboru, `details: { issues, total }` (viď vyššie)                           |

## Limity

| Limit                | Hodnota      | Kde                                                                                                                            |
| -------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| obsah súboru         | 10 MB        | `IMPORT_FILE_MAX_BYTES`, kontroluje backend v bajtoch pred validáciou tela (413), frontend pred odoslaním                      |
| telo požiadavky      | 12 MB        | `express.json({ limit: '12mb' })` pre celý prefix `/api/projects/:projectId/imports` (aj budúce cesty pod ním), ostatné 100 kB |
| nginx                | 12 MB        | `client_max_body_size 12m` v `location /api/` (predvolene má nginx 1 MB)                                                       |
| kľúč                 | 2 000 znakov | `IMPORT_KEY_MAX_LENGTH`                                                                                                        |
| vypísané chyby       | 50           | `IMPORT_ISSUES_MAX`                                                                                                            |
| vypísané upozornenia | 1 000        | `IMPORT_WARNINGS_MAX`                                                                                                          |

Telo ciest importu sa parsuje až po overení session a prístupu k projektu, takže neprihlásený klient nedokáže poslať 12 MB na spracovanie. Rezerva 2 MB medzi obsahom a telom je pre JSON escapovanie (`"`, `\`, nové riadky). Súbor tesne pod 10 MB s množstvom takých znakov môže po serializácii do JSON prekročiť 12 MB; nginx potom odpovie vlastnou HTML stránkou 413 (nie chybovým kontraktom), preto frontend (míľnik D) musí pred odoslaním kontrolovať veľkosť serializovaného tela, nie iba súboru.

Kľúč s 2 000 znakmi v cyrilike (≈ 4 kB v UTF-8) dnes neprejde unikátnym indexom `(projectId, namespace, name)` (limit btree ~2,7 kB na riadok indexu). Preview ho prijme, rieši sa pred zápisom importu.

## Výkon

Integračný test: súbor s 2 500 kľúčmi v 9 jazykoch proti projektu s rovnakými kľúčmi a prekladmi, preview trvá lokálne okolo 90 ms. Kľúče a preklady sa načítajú jedným dotazom (`unnest` kľúčov zo súboru, spojenie cez unikátny index).

## Príklad (curl)

```bash
jq -n --rawfile content translations.csv '{ fileName: "translations.csv", content: $content }' \
	| curl -i -b cookies.txt -H 'Content-Type: application/json' -H 'X-Requested-With: XMLHttpRequest' \
		--data-binary @- "http://localhost:8080/api/projects/<id projektu>/imports/preview"
```
