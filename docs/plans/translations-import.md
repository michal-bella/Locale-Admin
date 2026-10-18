---
title: 'Preklady a import CSV – implementačný plán'
updated: 2026-10-18
notion_page_id:
---

# Preklady a import CSV

## Kontext

Projekt dnes má jazyky a členov, ale žiadne preklady. Tento plán pridáva:

1. **Zoznam prekladov** `/projects/$projectSlug/translations` (Figma [3-2](https://www.figma.com/design/8mjlOXj1MXEqGwkWlf83mZ/Admin-system-for-translations?node-id=3-2)): kľúče s textom zdrojového a cieľového jazyka, stav, vyhľadávanie, filter, zoradenie, zoskupenie, úprava prekladu priamo v riadku.
2. **Import CSV** (Figma [3-2042](https://www.figma.com/design/8mjlOXj1MXEqGwkWlf83mZ/Admin-system-for-translations?node-id=3-2042)): nahratie súboru → kontrola (jazyky, chyby, zmeny) → import.

Mimo rozsahu: export, formáty JSON a XLSX, stav „Na kontrolu“, história importov, riešenie konfliktov po jednom kľúči, mazanie kľúčov, ktoré v súbore chýbajú, prehľad projektu (Overview).

### Potvrdené rozhodnutia (zo zadania)

- Stav prekladu sú len dva a **odvodzujú sa z hodnoty**, v DB sa neukladajú: vyplnený preklad = **Preložené** (automaticky schválený), `null` = **Nepreložené**. Karta a filter „Na kontrolu“ z Figmy sa vypúšťajú.
- Predvolené zoradenie: nepreložené najprv. Nepreložená bunka má jemné červené pozadie.
- Kľúče so štruktúrou objektu (`orders.empty.title`) sa zoskupujú podľa objektu ako v Tolgee.
- Chyba v súbore import zablokuje a vypíše, čo a na ktorom riadku treba opraviť.
- Jazyk zo súboru, ktorý projekt nemá, sa zobrazí ako upozornenie s možnosťou jazyk pridať (ako Tolgee).

### Rozhodnutia z 2026-10-18

1. **`""` sa pri importe skonvertuje na `null`** = Nepreložené. Napr. Stoodio jazyky bg, de-AT, hr, hu, ro, ru zatiaľ nepodporuje, preto sú prázdne; označenie „netreba prekladať“ môže prísť neskôr.
2. **Zobrazenie podľa Figmy**: zdrojový jazyk → jeden cieľový jazyk.
3. **Namespace = JSON súbor** (`<tag>/<namespace>.json`, v CSV sekcia `--namespace--`). Musí sa zachovať presne, lebo budúci export z neho generuje JSON súbory po jazykoch aj sekcie v CSV, podľa ktorých import skript v projekte delí preklady. V zozname slúži ako skupina a filter.
4. **Import vždy prepíše** existujúce preklady hodnotami zo súboru (bez checkboxu). Výnimka: `null` v súbore nezmaže preklad, ktorý je v DB vyplnený (inak by opätovný import z kódu zmazal prácu prekladateľa).

## Analýza vzorového súboru

`Notino-B2B-Web/public/translations.csv`, vygenerovaný `npx convert-json-to-csv GoodRequest/i18nextJsonToCsv` z `public/locales/<tag>/<namespace>.json`:

| Vlastnosť | Zistenie |
|---|---|
| Kódovanie | UTF-8 bez BOM, 2 459 riadkov, 945 kB |
| Hlavička | `Keys; bg ; cs ; de-AT ; en ; hr ; hu ; ro ; ru ; sk ` – prvý stĺpec `Keys`, potom tagy jazykov s medzerami okolo |
| Oddeľovač | `; ` (bodkočiarka + medzera), každý dátový riadok začína medzerou. **Žiadne úvodzovky ani escapovanie** – hodnota s `; ` by rozbila riadok (vo vzorke 0 takých, všetky riadky majú 10 stĺpcov) |
| Sekcie | riadky `--loc--`, `--notino-partner--`, `--paths--`, `--stoodio--` = namespace (JSON súbor). Prázdny namespace `keep-empty` sa do CSV nedostane |
| Kľúče | ploché, kľúč je slovenský text (i18next-scanner), nie cesta. Unikátne v rámci namespace, **51 kľúčov je v dvoch namespace** naraz. 506 kľúčov obsahuje bodku, lebo sú to vety (`Adresa nie je kompletná. Uistite sa`) – podľa bodky ich teda **nesmieme** rozdeľovať na objekty |
| Nepreložené | doslovný reťazec `null`: 204 v každom z bg, cs, de-AT, hr, hu, ro, ru, 13 v en, 0 v sk |
| Prázdne | `""` 61× v bg, de-AT, hr, hu, ro, ru – celý namespace `stoodio` (v JSON naozaj `""`, nie `null`) |
| Obsah hodnôt | premenné `{{count}}` aj `{{ count }}` (197 hodnôt), HTML `<strong>`, `<a>`, `<br>`, `<button>` (122), žiadne nové riadky, max. dĺžka kľúča 1 493 znakov, hodnoty 1 395 |
| Medzery | žiadny kľúč ani hodnota v JSON nezačína ani nekončí medzerou → orezať každé pole je bezpečné |

Dôsledky: parser je pre tento formát vlastný (nie RFC 4180), namespace je súčasť identity kľúča, zoskupenie podľa objektu sa robí len pre kľúče, ktoré vyzerajú ako cesta (`^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)+$`, bez medzier). Pri tomto projekte je skupina = namespace.

## Dátový model (migrácia `translations`)

```prisma
model TranslationKey {
  id          String        @id @default(uuid()) @db.Uuid
  projectId   String        @db.Uuid
  project     Project       @relation(fields: [projectId], references: [id], onDelete: Cascade)
  namespace   String        @default("")
  name        String
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
  translations Translation[]

  @@unique([projectId, namespace, name])
}

model Translation {
  keyId       String          @db.Uuid
  key         TranslationKey  @relation(fields: [keyId], references: [id], onDelete: Cascade)
  languageId  String          @db.Uuid
  language    ProjectLanguage @relation(fields: [languageId], references: [id], onDelete: Cascade)
  value       String?
  updatedById String?         @db.Uuid
  updatedBy   User?           @relation(fields: [updatedById], references: [id], onDelete: SetNull)
  updatedAt   DateTime        @updatedAt

  @@id([keyId, languageId])
  @@index([languageId])
}
```

- **Nepreložené** = riadok chýba alebo `value` je `null`. Stav sa počíta v SQL, neukladá sa. `""` sa do DB nedostane (import aj úprava ho uložia ako `null`).
- `namespace` je názov JSON súboru (`loc`, `paths`, …) a pre export sa musí zachovať presne.
- Odobratie jazyka z projektu zmaže jeho preklady (cascade) – potvrdzovací modál Odobrať jazyk dostane vetu o počte prekladov.
- Nový jazyk pridaný po importe nemá riadky → všetky kľúče sú v ňom nepreložené, nič sa nedopĺňa.
- `Project.protectVariables` (už existuje) sa začne používať pri úprave prekladu.
- Index pre vyhľadávanie: `pg_trgm` GIN na `TranslationKey.name` a `Translation.value` až keď bude treba (2 500 kľúčov × 10 jazykov ILIKE zvládne bez neho, zmerať v kroku A).
- Seed: seedovaný projekt dostane ~30 kľúčov v 2 namespace (časť nepreložená, jeden kľúč-cesta), aby stránka nebola prázdna. Reálny Notino súbor do repa **nepatrí** (dáta klienta); E2E fixture je malý vymyslený CSV v rovnakom formáte.

## Kontrakt (`packages/shared/src/translations.ts`, `imports.ts`)

- `translationStatusSchema = z.enum(['TRANSLATED', 'UNTRANSLATED'])`.
- `translationsQuerySchema`: `sourceLanguageId`, `targetLanguageId`, `search?`, `status?`, `namespace?`, `sort` (`UNTRANSLATED_FIRST` predvolené, `KEY`, `UPDATED`), `page`, `pageSize` (max 100).
- `translationsResponseSchema`: `{ items: [{ keyId, namespace, name, group, source: { value }, target: { value, status, updatedAt } }], total, page, pageSize, stats: { totalKeys, translated, untranslated }, namespaces: string[] }`. `group` počíta backend (namespace + prefix cesty).
- `updateTranslationRequestSchema`: `{ value: string | null }`, max. 10 000 znakov.
- `importPreviewRequestSchema`: `{ fileName, content }` (obsah súboru ako text, max. 10 MB).
- `importPreviewResponseSchema`: `{ columns: [{ tag, columnIndex, match: 'PROJECT' | 'CATALOG' | 'UNKNOWN', languageId?, stats: { translations, untranslated, warnings } }], keys: { total, new, existing }, changes: [{ tag, new, changed, unchanged, keptBecauseNull }], warnings: Issue[] }`.
- `importRequestSchema`: `{ fileName, content, columns: [{ columnIndex, languageId | null }], createMissingKeys: boolean }` → `importResultSchema` `{ keysCreated, translationsCreated, translationsUpdated, skippedColumns }`.
- `Issue = { code, line?, column?, params? }`, kódy v `IMPORT_ISSUE_CODES` (FE prekladá kód, nikdy text).
- Nové chybové kódy: `IMPORT_FILE_INVALID` (422, `details.issues`), `IMPORT_FILE_TOO_LARGE` (413), `IMPORT_COLUMNS_INVALID` (400), `PLACEHOLDER_MISMATCH` (400), `TRANSLATION_KEY_NOT_FOUND` (404).

## Pravidlá importu

### Chyby – súbor sa neimportuje, používateľ ho opraví

| Kód | Kedy |
|---|---|
| `FILE_EMPTY` | prázdny súbor alebo len hlavička |
| `FILE_NOT_UTF8` | neplatné UTF-8 (BOM sa ticho odstráni) |
| `HEADER_INVALID` | prvý stĺpec nie je `Keys` alebo chýba aspoň jeden jazyk |
| `HEADER_EMPTY_TAG` | prázdny názov stĺpca jazyka |
| `HEADER_DUPLICATE_TAG` | ten istý tag dvakrát |
| `ROW_COLUMN_COUNT` | riadok má iný počet polí ako hlavička (typicky `; ` vnútri textu) – s číslom riadku, očakávaným a skutočným počtom |
| `ROW_EMPTY_KEY` | prázdny kľúč |
| `ROW_DUPLICATE_KEY` | kľúč dvakrát v tom istom namespace – s oboma číslami riadkov |
| `KEY_TOO_LONG` | kľúč nad 2 000 znakov |
| `NAMESPACE_INVALID` | riadok `--…--` s prázdnym alebo neplatným názvom |

Vypíše sa prvých 50 chýb + celkový počet, každá s číslom riadku.

### Upozornenia – import sa dá dokončiť

- `PLACEHOLDER_MISMATCH`: premenné `{{…}}` v preklade sa líšia od zdrojového jazyka (porovnanie bez medzier, `{{ count }}` = `{{count}}`). Počet pri jazyku (žltý trojuholník ako v Tolgee), zoznam v detaile.
- `LANGUAGE_NOT_IN_PROJECT`: tag je v katalógu, ale projekt ho nemá → v riadku jazyka tlačidlo **Pridať jazyk** (existujúci `POST /languages`), alebo **Preskočiť**.
- `LANGUAGE_UNKNOWN`: tag nie je v `SUPPORTED_LANGUAGES` (napr. `pl`) → stĺpec sa dá len priradiť k jazyku projektu ručne alebo preskočiť.
- `BASE_LANGUAGE_UNTRANSLATED`: `null` v základnom jazyku.

### Zlúčenie s existujúcimi dátami

- Kľúč sa páruje podľa `(namespace, name)`. Chýbajúci kľúč sa vytvorí (checkbox **Vytvoriť chýbajúce kľúče** z Figmy, predvolene zapnutý; vypnutý = importujú sa len preklady existujúcich kľúčov).
- `null` v súbore **nikdy neprepíše** vyplnený preklad v DB (počíta sa ako `keptBecauseNull`).
- `""` v súbore sa uloží ako `null`.
- Rozdielna hodnota sa vždy prepíše (rozhodnutie 4). Kontrolný krok ukáže počty zmien na jazyk, aby používateľ vedel, čo sa prepíše.
- Kľúče, ktoré v súbore nie sú, ostávajú nedotknuté.
- Celý import je jedna transakcia s `pg_advisory_xact_lock` na projekt (dva súbežné importy toho istého projektu sa zoradia). Zápis cez `INSERT … ON CONFLICT DO UPDATE` s `unnest` po dávkach (25 000 riadkov za < 2 s je cieľ, overiť na vzorke).
- Preview je bezstavový: FE drží súbor v pamäti a pri importe ho pošle znova, backend ho znova parsuje a validuje (žiadna tabuľka rozpracovaných importov).

### Limity

- `express.json({ limit: '12mb' })` len na routách importu, ostatné ostávajú na 100 kB.
- **nginx má predvolene `client_max_body_size 1m`** → 945 kB súbor v JSON neprejde. Pridať `client_max_body_size 12m;` do `location /api/` v `docker/nginx/default.conf`.
- FE kontroluje príponu `.csv` a veľkosť ≤ 10 MB ešte pred odoslaním.

## API

| Metóda | Cesta | Popis |
|---|---|---|
| GET | `/api/projects/:projectId/translations` | stránkovaný zoznam podľa `translationsQuerySchema`, `stats` pre cieľový jazyk |
| PUT | `/api/projects/:projectId/keys/:keyId/translations/:languageId` | `{ value }`; pri `protectVariables` 400 `PLACEHOLDER_MISMATCH`; 404 pre cudzí kľúč alebo jazyk |
| POST | `/api/projects/:projectId/imports/preview` | analýza súboru, nič nezapisuje; 422 `IMPORT_FILE_INVALID` |
| POST | `/api/projects/:projectId/imports` | import; 422 ako preview, 400 `IMPORT_COLUMNS_INVALID` (cudzí `languageId`, ten istý jazyk dvakrát, všetko preskočené) |

Všetko za `requireProjectAccess`. Parser je v `backend/src/lib/import/csvParser.ts` (čistá funkcia `string → ParsedFile | issues`), ďalšie formáty neskôr pribudnú ako ďalšie parsery do rovnakého `ParsedFile`.

## Frontend

### Stránka Preklady

- Route `/projects/$projectSlug/translations` (lazy), v sidebari prvá položka **Preklady**; `/projects/$projectSlug` presmeruje sem namiesto do nastavení. ProjectSwitcher zachová `/translations`.
- Hlavička podľa Figmy: odznak projektu, nadpis, popis, tlačidlo **Importovať**. Exportovať sa nezobrazuje.
- Tri karty: **Celkom kľúčov**, **Preložené** (progress), **Chýbajúce** (progress) – pre vybraný cieľový jazyk.
- Toolbar: vyhľadávanie (kľúč aj text, debounce 300 ms, v URL search params), stav (Všetky / Nepreložené / Preložené), namespace (len ak má projekt viac ako jeden), zoradenie, vpravo zdrojový jazyk → cieľový jazyk (predvolene základný → prvý iný). Filtre žijú v URL (`validateSearch` zod schémou), aby sa dali zdieľať a prežili reload.
- Tabuľka: Kľúč (monospace, pod ním skupina a „pred 2 min.“), zdrojový text, cieľový preklad, Stav (odznak Preložené zelený / Nepreložené červený). Nepreložený riadok má jemné červené pozadie (nový token `--app-color-untranslated-bg` pre light aj dark).
- Zoskupenie: hlavička skupiny sa vloží vždy, keď sa `group` zmení oproti predchádzajúcemu riadku. Zoradenie `UNTRANSLATED_FIRST` = stav, skupina, kľúč, takže nepreložené idú prvé a vnútri sú zoskupené.
- Premenné `{{…}}` ako chip (ako vo Figme), HTML sa zobrazuje ako text, nikdy sa nerenderuje.
- Stránkovanie podľa Figmy (50 na stranu, „Zobrazených 50 z 2 458 kľúčov“).
- Prázdny stav projektu bez kľúčov: text + tlačidlo Importovať. Stavy loading, error, nič nenájdené.

### Úprava prekladu v riadku

- Klik do bunky cieľa → `Textarea` s autosize, uloží sa pri blur a `Ctrl/Cmd+Enter`, `Esc` zruší. Prázdny text uloží `null` (nepreložené).
- Optimistická aktualizácia hodnoty, stavu aj kariet; pri chybe návrat a notifikácia s preloženým kódom. `PLACEHOLDER_MISMATCH` sa zobrazí priamo pod poľom.
- Klávesnica: `Tab` na ďalší riadok, prístupné meno poľa obsahuje kľúč a jazyk.

### Import (modál, 2 kroky)

1. **Nahratie** podľa Figmy: dropzone (vlastná, bez `@mantine/dropzone`, alebo ju doplniť – rozhodnúť pri implementácii po overení docs), chip len **CSV**, checkbox Vytvoriť chýbajúce kľúče, **Pokračovať na kontrolu** zavolá preview.
   - 422 → zoznam chýb v modáli („Riadok 812: očakávaných 10 stĺpcov, nájdených 11“), súbor sa dá vymeniť.
2. **Kontrola** (Figma ho nemá, návrh podľa Tolgee): tabuľka jazykov zo súboru – Jazyk (select z jazykov projektu, predvyplnený podľa tagu), stĺpec v súbore, počet prekladov, nepreložené, upozornenia, nové / zmenené. Riadok bez jazyka je zvýraznený s textom „Jazyk ru nie je v projekte“ a tlačidlom **Pridať jazyk** (po pridaní sa preview zopakuje) a **Preskočiť**. Súhrn: X nových kľúčov, Y prekladov sa prepíše; **Importovať** / **Zrušiť import**.
- Po importe notifikácia so súhrnom, invalidácia prekladov a jazykov, modál sa zavrie.
- Modál je široký (`size='xl'`), na mobile na celú obrazovku.

## Testy a docs

- Shared: schémy (query, preview, import, kódy).
- Backend unit: `csvParser` – vzorka formátu, BOM, `null` aj `""` → `null`, namespace, duplicity, zlý počet stĺpcov, medzery, premenné s medzerami aj bez.
- Backend integration: zoznam (filtre, zoradenie, stránkovanie, stats, cudzí projekt 404), úprava (placeholder ochrana zapnutá/vypnutá), preview (každý kód chyby), import (nový projekt, opakovaný import = 0 zmien, zmenená hodnota sa prepíše, `null` neprepíše vyplnený, preskočený stĺpec, cudzí `languageId`, súbežné importy), výkon: generovaný súbor 2 500 × 10 do 5 s.
- FE unit: TranslationsPage (stavy, filtre v URL, skupiny, červené riadky), úprava v riadku, ImportModal (oba kroky, chyby, pridanie jazyka).
- E2E: import fixture CSV s chýbajúcim jazykom → pridanie jazyka → import → zoznam ukáže nepreložené prvé → preloženie v riadku → stav Preložené; chybný súbor ukáže chybu s riadkom; a11y kontrola oboch obrazoviek.
- Docs: `docs/api/translations.md`, `docs/api/imports.md` (vrátane formátu CSV a zoznamu kódov), `docs/database.md`, `docs/frontend.md`, `docs/testing.md`, `docs/overview.md`, `AGENTS.md` (Doména: Kľúč, Preklad, Namespace), `changelog`.

## Postup a overenie

Vetva `feature/translations` z `main`, každý míľnik vo vlastnej session s commitom a reportom.

| Míľnik | Obsah | Overenie |
|---|---|---|
| **A** Dátový model + zoznam | migrácia, seed, `GET translations`, stránka Preklady len na čítanie (karty, toolbar, tabuľka, skupiny, stránkovanie, prázdny stav), sidebar, redirect | `pnpm db:migrate`, `pnpm test:integration`, FE testy, ručne `:5173` + porovnanie s Figmou 3-2 |
| **B** Parser + preview | `csvParser`, chybové kódy, `POST imports/preview`, limity express + nginx | unit testy parsera na vzorke, integration preview, `curl` so vzorovým súborom cez `:8080` |
| **C** Zápis importu | `POST imports`, zlúčenie, advisory lock, dávkový upsert | integration testy importu + výkon, opakovaný import vzorky = 0 zmien |
| **D** Import UI | modál krok 1 a 2, chyby, pridanie jazyka, súhrn | FE testy, ručne vzorový Notino súbor (bez commitu súboru) |
| **E** Úprava v riadku | `PUT` prekladu, placeholder ochrana, optimistický update, klávesnica | integration + FE testy |
| **F** E2E, a11y, docs | E2E scenáre, accessibility review, docs, `changelog` | `pnpm verify`, `pnpm test:e2e` |

### Odložené z míľnika A

- Kľúče s prázdnym namespace `""` sa nedajú vyfiltrovať (prázdna hodnota filtra = bez filtra). Riešiť, keď import začne vytvárať kľúče mimo sekcie `--…--`, napr. hodnotou `namespace=~none`.
- B: integračný test s kľúčom 2 000 znakov v cyrilike (unikátny btree index na `(projectId, namespace, name)` má limit ~2,7 kB); ak neprejde, limit v bajtoch alebo index na `md5(name)`.
- C: `updatedAt` nemá v DB default, dávkový upsert cez `unnest` ho musí nastaviť (`now()`).

## Odhad

| Míľnik | Človekodni (MD) |
|---|---|
| A Dátový model + zoznam | 3 – 4 |
| B Parser + preview | 2 – 2,5 |
| C Zápis importu | 1,5 – 2 |
| D Import UI | 3 – 4 |
| E Úprava v riadku | 2 – 3 |
| F E2E, a11y, docs | 1,5 – 2 |
| **Spolu** | **13 – 17,5 MD** (≈ 3 – 3,5 týždňa jedného vývojára) |

Čistý čas agentov (jedna session na míľnik) je odhadom 6,5 – 9 h, bez čakania na review. Rezerva je hlavne v D (návrh kontrolného kroku bez Figmy, iterácie s používateľom) a v E (premenné ako chip počas úpravy – v pláne zámerne len pri zobrazení, počas úpravy čistý text).
