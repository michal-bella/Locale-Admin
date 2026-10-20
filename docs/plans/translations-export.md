---
title: 'Export prekladov do CSV – implementačný plán'
updated: 2026-10-20
notion_page_id:
---

# Export prekladov do CSV

## Kontext

Projekt vie preklady importovať z CSV, ale nevie ich dostať späť. Tento plán pridáva **export** (Figma [3-2430](https://www.figma.com/design/8mjlOXj1MXEqGwkWlf83mZ/Admin-system-for-translations?node-id=3-2430)): modál **Exportovať preklady** s výberom formátu, jazykov a stavu, výsledok je súbor, ktorý cieľový projekt (napr. Notino B2B Web) načíta svojím skriptom `pnpm translations-csv-to-json` bez úprav.

Postup podľa `.agents/workflows/feature.md` na vetve `feature/translations-export`. Po každom míľniku checkpoint (`pnpm verify`, `docs/`, commit, krátky report).

### Rozsah

| Prvok                                                                                        | Teraz                          |
| -------------------------------------------------------------------------------------------- | ------------------------------ |
| Formát **CSV** (karta vo Figme), ostatné karty JSON / XLSX / ARB                             | len CSV; ďalšie neskôr         |
| **Jazyky** – všetky jazyky projektu, predvolene všetky označené, aspoň jeden povinný         | áno                            |
| **Stav** – Všetky (predvolené) / Preložené / Nepreložené                                     | áno                            |
| Tagy (zahrnúť / vylúčiť kľúče s tagmi), vylúčené kľúče                                       | nie                            |
| Checkbox **Zahrnúť popisy a metadáta kľúčov**                                                | nie (skrytý)                   |
| Formát správ a premenných (Tolgee „ICU“)                                                     | nie, hodnoty idú tak, ako sú uložené |
| Obnoviť predvolené (Tolgee „Reset to defaults“)                                              | nie, modál sa pri otvorení vždy naplní predvolenými hodnotami |

Dátový model sa nemení, **nová migrácia nie je**. Migrácia `20261020131146_language_position` z predchádzajúcej zmeny sa pri nasadení spustí sama: `docker/backend-entrypoint.sh` volá `prisma migrate deploy` pri štarte kontajnera (pri 2 podoch ju Prisma zoradí cez advisory lock, druhý pod nič nespraví).

## Cieľový formát (spätne overený)

Formát je presne ten, ktorý číta `@goodrequest/convert-translations-i18next` (`convert-csv-to-json`) a ktorý vie čítať náš import (`backend/src/lib/import/csvParser.ts`). Analýza `Notino-B2B-Web/public/translations.csv` a zdrojáku skriptu:

```text
Keys; bg ; cs ; de-AT ; en ; sk ⏎
--loc--⏎
 (vlastná); (по избор); (vlastní); (benutzerdefiniert); (custom); (vlastné)⏎
 Kľúč bez prekladu; null; null; null; null; Kľúč bez prekladu⏎
--paths--⏎
 about-application; /about-application; …⏎
```

| Časť         | Pravidlo                                                                                                                                       |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Kódovanie    | UTF-8 bez BOM, riadky `\n`, posledný riadok končí `\n`                                                                                          |
| Hlavička     | `Keys` + pre každý jazyk `; <tag> ` (medzera pred aj za tagom)                                                                                  |
| Sekcia       | `--<namespace>--` pred kľúčmi každého namespace, namespace zoradené podľa bajtov (`COLLATE "C"`); kľúče bez namespace (`""`) idú na začiatok bez sekcie |
| Riadok       | ` <kľúč>` + pre každý jazyk `; <hodnota>`, kľúče v namespace zoradené podľa bajtov (vzorka je presne takto zoradená)                             |
| Nepreložené  | `null` (rozhodnutie 1)                                                                                                                            |
| Plurál       | jedna ICU správa v bunke (`{count, plural, one {…} other {…}}`), presne ako je uložená; import ju načíta späť                                   |

**Čo skript cieľového projektu rozbije** (riadok sa delí `split(';')`, súbor `split('\n')`, sekcia sa hľadá regexom `/--(.*?)--/` kdekoľvek v riadku, polia sa orezávajú):

- `;` kdekoľvek v kľúči alebo hodnote (aj HTML entita `&nbsp;`) → posunuté stĺpce,
- `\n` alebo `\r` → rozdelený riadok,
- `--niečo--` kdekoľvek v riadku → riadok sa vyhodnotí ako nový súbor,
- medzera na začiatku / konci hodnoty → ticho zmizne.

Vo vzorke dnes nie je ani jeden taký prípad (všetkých 2 455 dátových riadkov má po `split(';')` presne 10 polí), ale editor v aplikácii ich zadať dovolí. Riešenie: rozhodnutie 3.

## Kontrakt (`packages/shared/src/exports.ts`)

- `EXPORT_FORMATS = ['CSV'] as const`, `exportFormatSchema`.
- `exportStatusSchema = z.enum(['ALL', 'TRANSLATED', 'UNTRANSLATED'])`.
- `exportQuerySchema`: `{ format: 'CSV', languageIds: uuid[] (min 1, unikátne, `z.preprocess` z čiarkou oddeleného reťazca), status: default 'ALL' }`.
- Chybové kódy: `EXPORT_LANGUAGES_INVALID` (400, jazyk nepatrí projektu), `EXPORT_BUSY` (429, `Retry-After`), `EXPORT_VALUE_UNSAFE` (422, `details.issues: { code, namespace, key, languageTag? }[]` max. 50 + `total`; len ak sa pri otázke 3 zvolí blokovanie).

## API

| Metóda | Cesta                                   | Popis                                                                                                    |
| ------ | --------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| GET    | `/api/projects/:projectId/export`       | query `exportQuerySchema`; `200 text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="…"` |

- Prístup ako pri zozname prekladov: člen projektu alebo `ADMIN`, inak 404 (projekt sa neprezrádza).
- GET, lebo export nič nemení a parametre sú krátke (ID jazykov).
- Názov súboru: rozhodnutie 5.

## Výkon a ochrana pamäte

Očakávanie: max. 3 používatelia, tisíce kľúčov (vzorka: 2 459 kľúčov × 10 jazykov ≈ 1 MB CSV). Prostredie: 2 pody, 2 GB pamäte na pod. Návrh je dimenzovaný tak, aby pamäť **nezávisela od veľkosti projektu ani od počtu súbežných exportov**.

1. **Streamovanie po dávkach.** Backend nečíta celý projekt do pamäte. Kľúče číta keyset stránkovaním po 1 000 (`ORDER BY namespace COLLATE "C", name COLLATE "C"`, `WHERE (namespace, name) > (…)`), ku každej dávke jedným dotazom preklady vybraných jazykov, a hneď zapisuje do `res`. Rešpektuje backpressure (`res.write()` vráti `false` → počká na `drain`). Pamäť jedného exportu ≈ jedna dávka (stovky kB). Spojenie z DB poolu drží len počas jedného dotazu, nie počas celého exportu.
2. **Limit súbežných exportov na pod** (in-process semafor, ENV `EXPORT_MAX_CONCURRENT`, predvolene 2, a fronta `EXPORT_QUEUE_MAX`, predvolene 20, s čakaním max. `EXPORT_QUEUE_TIMEOUT_MS` 10 s). Plná fronta alebo vypršané čakanie → `429 EXPORT_BUSY` s `Retry-After`. FE zobrazí preloženú hlášku „Export práve robí veľa ľudí, skúste to o chvíľu“. Pri 2 podoch teda naraz beží max. 4 exporty, ostatné čakajú, nič nepadne na pamäť.
3. **Zrušenie pri odpojení klienta.** `req.on('close')` zastaví ďalšie dávky a uvoľní slot (žiadne „visiace“ exporty, keď niekto zavrie kartu).
4. **Časový limit** celého exportu (`EXPORT_TIMEOUT_MS`, 60 s); po ňom sa stream ukončí chybou a slot sa uvoľní (`finally`).
5. **Node heap pod limitom kontajnera.** `NODE_OPTIONS=--max-old-space-size=1536` v `backend.Dockerfile`, aby GC zasiahol skôr, ako kontajner zabije OOM killer pri 2 GB.
6. **nginx**: `proxy_buffering` ostáva zapnutý (nginx si odpoveď nabufferuje na disk, Node pošle dáta rýchlo a uvoľní slot aj pri pomalom klientovi).

### Záťažové testy (míľnik C)

- Nástroj **k6** cez Docker (`grafana/k6`, nič sa neinštaluje do repa), skript `scripts/load/export.k6.js` + `scripts/load/run-export.sh`.
- Dáta: `scripts/load/seed-export.sql` (generate_series) vytvorí projekt **M** (5 000 kľúčov × 10 jazykov = 50 000 prekladov, hodnoty ~120 znakov) a **L** (50 000 kľúčov × 10 jazykov = 500 000, 10× nad očakávaním).
- Stack beží s `mem_limit: 2g` na backende (override `docker-compose.load.yml`, len pre test) a voliteľne `--scale backend=2`.
- Scenáre:

  | Scenár     | Záťaž                                   | Cieľ                                                                     |
  | ---------- | --------------------------------------- | ------------------------------------------------------------------------ |
  | baseline   | 1 používateľ, projekt M, 20×            | p95 < 1 s, súbor bajtovo rovnaký pri každom behu                         |
  | realistic  | 3 súbežní, projekt M, 2 min             | 0 chýb, p95 < 2 s                                                        |
  | spike      | **100 súbežných**, projekt M            | žiadny 5xx ani reštart kontajnera; časť dostane 429, zvyšok 200; RSS < 1 GB |
  | big        | 10 súbežných, projekt L                 | RSS sa nezvýši úmerne veľkosti projektu (streamovanie funguje)            |
  | soak/leak  | spike 3× po sebe s 1 min pauzou         | RSS a `heapUsed` sa po každom kole vrátia k baseline ±10 % (žiadny leak), aktívne sloty = 0 |
  | abort      | 50 klientov preruší sťahovanie po 100 ms | sloty sa uvoľnia, ďalší export prejde hneď                               |

- Meranie pamäte: `docker stats` vzorkované každú sekundu do CSV + `heapUsed` z dočasného logu po každom exporte (log `export finished` s trvaním, počtom riadkov a `process.memoryUsage().heapUsed`).
- Výsledky (tabuľka p50/p95, max RSS, počet 429) idú do `docs/testing.md`. Ak niektorý cieľ neprejde, upravia sa limity alebo veľkosť dávky a test sa zopakuje.

## Frontend

- Tlačidlo **Exportovať** (ikona download) v hlavičke stránky Preklady vedľa **Importovať** (`TranslationsPage.tsx`; stránka Prehľad z Figmy v aplikácii zatiaľ nie je).
- `ExportModal` (`components/ExportModal/`): Mantine `Modal`, nadpis „Exportovať preklady“, podnadpis „Vyberte jazyky a formát výstupného súboru.“
  - **Formát výstupu**: karta CSV „Univerzálna tabuľka“ označená; ostatné karty neaktívne s „Čoskoro“ (rozhodnutie 6).
  - **Názov súboru**: `TextInput` predvolene `translations`, prípona `.csv` za poľom; **Jazyky**: checkbox chipy v poradí jazykov projektu (základný prvý, potom `position`), predvolene všetky; bez výberu je **Exportovať** neaktívne s hláškou.
  - **Stav**: `SegmentedControl` Všetky / Preložené / Nepreložené, predvolene Všetky.
  - Päta: **Zrušiť**, **Exportovať CSV** (loading počas sťahovania).
- Stiahnutie: `axios.get(…, { responseType: 'blob' })` → `URL.createObjectURL` → dočasný `<a download>` → `revokeObjectURL`. Pri chybe sa blob prečíta ako JSON a zobrazí sa preložený `code` (pravidlo 3). Blob ~1 MB je v prehliadači bez problému.
- i18n `sk`, `en` (a `cs`, keďže v repe je), unit test modálu, E2E: export → súbor sa stiahne → obsah sedí s fixture → **re-import toho istého súboru ukáže 0 zmien**.

## Míľniky

### A – Kontrakt a backend export (`backend-developer`)

1. `packages/shared/src/exports.ts` + chybové kódy, unit testy schém.
2. `lib/export/csvWriter.ts` (čisté funkcie: hlavička, sekcia, riadok, kontrola bezpečnosti hodnoty) s unit testami.
3. `exports.service.ts` – keyset dávky, filter stavu, zoradenie `COLLATE "C"`, stream s backpressure a abortom.
4. Route + controller, prístupové práva, `Content-Disposition`.
5. Integračné testy: obsah a poradie, filter jazykov a stavu, cudzí jazyk → 400, nečlen → 404, plurál, kľúč bez namespace, **round-trip: import fixture → export → bajtovo rovnaký súbor**.
6. `docs/api/exports.md`, `docs/changelog.md`.

**Overenie:** `pnpm verify`; ručne: import reálneho Notino CSV lokálne → export → `diff` s originálom (rozdiel len rozhodnutie 2) → v kópii Notino-B2B-Web `pnpm translations-csv-to-json` → `git diff public/locales` bez neočakávaných zmien. Reálny súbor sa do repa nedostane.

### B – Ochrana proti záťaži (`backend-developer`)

1. Semafor + fronta + `429 EXPORT_BUSY` + `Retry-After`, ENV premenné v `config/env.ts` a `.env.example`.
2. Časový limit, uvoľnenie slotu vo `finally`, abort.
3. `NODE_OPTIONS` v Dockerfile.
4. Unit testy semaforu (plná fronta, timeout, uvoľnenie pri chybe a aborte), integračný test 429.
5. `docs/` (ENV, Docker, rozhodnutia).

**Overenie:** `pnpm verify`, `pnpm stack:up`, `api-smoke` (200, 400, 404, 429).

### C – Záťažové testy (`backend-developer` / orchestrátor)

1. Seed skript M a L, k6 scenáre, `docker-compose.load.yml` s `mem_limit: 2g`.
2. Spustenie scenárov z tabuľky, prípadné doladenie limitov.
3. Výsledky do `docs/testing.md`.

**Overenie:** všetky ciele z tabuľky splnené, výstup k6 a graf pamäte v reporte.

### D – Frontend modál (`frontend-developer`, paralelne s B a C po A)

1. API hook `useExportTranslations`, `ExportModal`, tlačidlo v hlavičke, i18n.
2. Porovnanie s Figmou (potvrdí používateľ).
3. Unit testy modálu (predvolené hodnoty, žiadny jazyk, chyba 429).
4. `docs/frontend.md`.

**Overenie:** `pnpm verify`, preview v prehliadači.

### E – E2E a review (`e2e-tester`, `accessibility-reviewer`, `code-reviewer`)

1. E2E: export, obsah súboru, re-import bez zmien, filter stavu.
2. A11y review modálu, code review celej vetvy.
3. Merge do `main` po odsúhlasení.

## Rozhodnutia z 2026-10-20

1. **Nepreložené = `null`** (holý token, nie prázdna bunka ani `""`), presne ako dnešný súbor.
2. **`""` sa neodlišuje od nepreloženého**: v DB sa neukladá, takže sekcia `stoodio` sa exportuje s `null` namiesto prázdnych buniek.
3. **Nebezpečné hodnoty export zablokujú**: `;`, nový riadok, `--x--` v riadku → `422 EXPORT_VALUE_UNSAFE` so zoznamom kľúčov a jazykov na opravu. Medzera na okraji hodnoty export neblokuje (skript ju len oreže, rovnako ako náš import).
4. **Stav sa vyhodnocuje po riadkoch** cez vybrané jazyky: Preložené = hodnota vo všetkých, Nepreložené = aspoň jedna chýba; prázdne bunky v riadku sú `null`.
5. **Názov súboru** si používateľ zadá v modáli, predvolene `translations` (`.csv` sa doplní). Server posiela `translations.csv`, FE ho prepíše cez `<a download>`.
6. **Karty JSON, XLSX, ARB** sa zobrazia neaktívne („Čoskoro“).
7. **Poradie stĺpcov jazykov = poradie v projekte** (základný jazyk prvý, potom `position`), ako v nastaveniach jazykov.

### Upresnenia pri implementácii

- Export číta dáta v jednej transakcii `REPEATABLE READ`, takže súbor je konzistentný snímok aj keď medzitým beží import. Najprv overí bezpečnosť hodnôt (prechod po dávkach bez zápisu), až potom pošle hlavičky a streamuje. Pamäť ostáva O(dávka). Transakcia drží jedno spojenie z poolu počas exportu; počet súbežných exportov obmedzí míľnik B.
