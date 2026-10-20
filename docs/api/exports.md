---
title: 'API: export prekladov'
updated: 2026-10-20
notion_page_id:
---

# Export prekladov (`/api/projects/:projectId/export`)

Stiahnutie prekladov projektu ako súbor. Zatiaľ iba CSV; JSON, XLSX a ARB prídu neskôr. Schémy sú v `packages/shared/src/exports.ts`, plán v `docs/plans/translations-export.md`.

| Metóda | Cesta                             | Prístup            | Popis                             |
| ------ | --------------------------------- | ------------------ | --------------------------------- |
| `GET`  | `/api/projects/:projectId/export` | člen alebo `ADMIN` | CSV s prekladmi vybraných jazykov |

Prístup rieši `requireProjectAccess` rovnako ako ostatné cesty projektu: bez session 401 `AUTH_UNAUTHENTICATED`, mimo prístupu 404 `NOT_FOUND` (viď [projekty](./projects.md#prístup-k-projektu)). Je to `GET`, nič nemení, CSRF hlavičky netreba.

## Query

| Parameter     | Povinný | Hodnota                                                                                                    |
| ------------- | ------- | ---------------------------------------------------------------------------------------------------------- |
| `languageIds` | áno     | ID jazykov projektu oddelené čiarkou, aspoň jeden, bez duplicít. Poradie stĺpcov určuje projekt, nie query |
| `status`      | nie     | `ALL` (predvolené), `TRANSLATED`, `UNTRANSLATED`                                                           |
| `format`      | nie     | `CSV` (predvolené, zatiaľ jediný)                                                                          |

**Stav** sa vyhodnocuje po kľúčoch cez vybrané jazyky: `TRANSLATED` = kľúč má hodnotu vo všetkých, `UNTRANSLATED` = aspoň jedna chýba (chýbajúci riadok alebo `null`). Bunky bez prekladu v exportovanom kľúči sú `null`.

## Odpoveď 200

`Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="translations.csv"`, `Cache-Control: no-store`. Telo je formát GoodRequest `i18nextJsonToCsv`, ktorý číta `npx convert-csv-to-json` v cieľovom projekte aj náš [import](./imports.md#formát-csv):

```text
Keys; sk ; en ; cs ⏎
 title; Titulok; null; null⏎
--loc--⏎
 Zrušiť; Zrušiť; null; null⏎
 Áno; Áno; Yes; Ano⏎
--paths--⏎
 orders; null; /orders; null⏎
```

- UTF-8 bez BOM, riadky `\n`, aj posledný.
- Hlavička `Keys` a pre každý jazyk `; <tag> `. Jazyky v poradí projektu: základný prvý, potom podľa `position` (ako na stránke Jazyky).
- Kľúče bez namespace (`""`) idú na začiatok bez sekcie, potom sekcia `--<namespace>--` a jej kľúče. Namespace aj kľúče sú zoradené podľa bajtov UTF-8 (`COLLATE "C"`), rovnako ako súbor z `convert-json-to-csv`, takže diff v gite ostáva malý. `convert-csv-to-json` zapíše kľúče bez namespace do `<tag>/.json`, preto majú mať kľúče cieľového projektu vždy namespace.
- Nepreložené = `null`. Prázdny reťazec sa v DB neukladá, preto sa `""` zo zdrojového JSON vráti ako `null`. Preklad, ktorý je doslova text `null`, sa v súbore nedá odlíšiť od nepreloženého (náš import ho načíta ako nepreložený).
- Plurálový kľúč má v bunke jednu ICU správu tak, ako je uložená (`{count, plural, one {…} other {…}}`).
- Hodnoty sa neupravujú (žiadne úvodzovky ani escapovanie).

Export import toho istého súboru vráti bajt po bajte (integračný test), s výnimkou `""` a poradia stĺpcov. Na reálnom súbore Notino B2B Web dáva `convert-csv-to-json` z exportu rovnaké JSON súbory ako z originálu, líši sa iba `""` → `"null"` v `stoodio` (jazyky bez prekladu).

### Ako sa odpoveď tvorí

Všetko beží v jednej transakcii `REPEATABLE READ`, takže súbor je konzistentný snímok aj počas súbežného importu. Kľúče sa čítajú po 1 000 (`EXPORT_BATCH_SIZE`, keyset stránkovanie); filter stavu sa vyhodnotí až v JS nad načítanou dávkou, nie v SQL, aby jeho cena nerástla s počtom zostávajúcich kľúčov. Prvý prechod iba kontroluje hodnoty, druhý pošle hlavičky a zapisuje dávky so spätným tlakom (čaká na `drain`). V pamäti je vždy najviac jedna dávka. Keď klient zavrie spojenie, export po aktuálnej dávke skončí (v oboch prechodoch) a transakcia sa uzavrie. Platí to aj pre klienta, ktorý odíde ešte počas overenia session a prístupu, teda skôr, ako kontrolér začne počúvať na `close` (zistí sa z `res.destroyed`); bez toho by export čakal na `drain` navždy a slot by sa nikdy neuvoľnil (našiel záťažový test, regresný test v `backend/test/exports.test.ts`). Každý dokončený export zapíše do logu `Export finished` s `keys`, `aborted`, `durationMs` a `heapUsedMb`. Celý export (vrátane sťahovania klientom) má limit `EXPORT_TIMEOUT_MS` (60 s): potom backend zavrie spojenie a export skončí pri najbližšom kroku; slot a spojenie do DB sa uvoľnia, keď dobehne práve bežiaci dotaz. Transakcia má limit o 5 s dlhší, aby export po vypršaní stihol skončiť sám a nezalogoval chybu zavretej transakcie.

## Súbežné exporty

Každý proces backendu (pod) púšťa naraz najviac `EXPORT_MAX_CONCURRENT` exportov (2). Ďalšie čakajú vo fronte s kapacitou `EXPORT_QUEUE_MAX` (20) najviac `EXPORT_QUEUE_TIMEOUT_MS` (10 s), v poradí príchodu. Plná fronta alebo vypršané čakanie vráti 429 `EXPORT_BUSY` s hlavičkou `Retry-After` (sekundy, zaokrúhlený `EXPORT_QUEUE_TIMEOUT_MS`). Klient, ktorý sa odpojí počas čakania, z fronty odíde. Slot sa uvoľní vždy, aj po chybe (400, 422, výpadok DB) či odpojení.

Limit je v pamäti procesu, pri 2 podoch teda naraz bežia najviac 4 exporty. Validácia query (400 `VALIDATION_ERROR`) prebehne skôr, než export čaká na slot. Hodnoty sú nastaviteľné cez ENV ([lokálny vývoj](../local-development.md)).

## Hodnoty, ktoré by súbor rozbili

`convert-csv-to-json` delí riadky podľa `;`, súbor podľa nového riadku a riadok s `--niečo--` kdekoľvek berie ako novú sekciu. Taký súbor by potichu pokazil preklady, preto ho export odmietne skôr, ako niečo pošle:

| `code`           | Kedy                                                                                                                                                             | `languageTag`                   |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `SEMICOLON`      | `;` v kľúči alebo v hodnote (aj `&nbsp;`)                                                                                                                        | jazyk hodnoty, pri kľúči `null` |
| `LINE_BREAK`     | `\n` alebo `\r` v kľúči alebo v hodnote                                                                                                                          | jazyk hodnoty, pri kľúči `null` |
| `NAMESPACE`      | namespace, ktorý skript prečíta inak: obsahuje `--` (`a--b` → `a`) alebo končí pomlčkou (`x-` → `x`, `-` nie je sekcia); hlási sa raz, pri prvom kľúči namespace | `null`                          |
| `SECTION_MARKER` | riadok obsahuje `--x--` (aj cez hranicu polí); kontroluje sa len pri riadku bez ostatných chýb                                                                   | `null`                          |

Kontrolujú sa iba exportované kľúče a jazyky (po filtri stavu). Medzera na začiatku alebo konci hodnoty export neblokuje, skript ju len oreže (rovnako ako náš import).

## Chyby

| HTTP | `code`                     | Kedy                                                                                                                                                                                                |
| ---- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 400  | `VALIDATION_ERROR`         | chýba `languageIds`, nie je UUID, duplicita, neznámy `status` alebo `format`                                                                                                                        |
| 400  | `EXPORT_LANGUAGES_INVALID` | jazyk nepatrí projektu                                                                                                                                                                              |
| 401  | `AUTH_UNAUTHENTICATED`     | bez session                                                                                                                                                                                         |
| 404  | `NOT_FOUND`                | projekt neexistuje alebo k nemu používateľ nemá prístup                                                                                                                                             |
| 422  | `EXPORT_VALUE_UNSAFE`      | [nebezpečné hodnoty](#hodnoty-ktoré-by-súbor-rozbili), `details: { issues, total }`, `issues` max. 50 (`EXPORT_ISSUES_MAX`) v poradí súboru, položka `{ code, keyId, namespace, key, languageTag }` |
| 429  | `EXPORT_BUSY`              | príliš veľa súbežných exportov v procese, [`Retry-After`](#súbežné-exporty)                                                                                                                         |

Chyba po začatí streamu (napr. výpadok DB) sa už nedá poslať ako JSON: backend ju zaloguje a spojenie zavrie, prehliadač dostane neúplné sťahovanie.

## Príklad

```bash
curl -s -b cookies.txt -o translations.csv -w '%{http_code}\n' \
  "http://localhost:8080/api/projects/$PROJECT_ID/export?languageIds=$SK_ID,$EN_ID&status=ALL"
```
