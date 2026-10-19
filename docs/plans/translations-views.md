---
title: 'Preklady: rozšírené a kompaktné zobrazenie, úprava v modále – implementačný plán'
updated: 2026-10-19
notion_page_id:
---

# Preklady: rozšírené a kompaktné zobrazenie, úprava v modále

## Kontext

Stránka `/projects/$projectSlug/translations` dnes zobrazuje podľa Figmy vždy dvojicu **zdrojový jazyk → cieľový jazyk** a preklad sa upravuje priamo v bunke (uloženie kliknutím mimo bunky alebo Ctrl/Cmd+Enter). Tento plán:

1. pridáva **rozšírené zobrazenie** (predvolené): všetky jazyky projektu ako stĺpce vedľa seba ako v Exceli, horizontálny scroll, stĺpce Kľúč a Stav zafixované (sticky), červené pozadie len na bunke bez prekladu, riadok je **Nepreložené**, kým nie je preložený v každom jazyku, a takéto riadky sú predvolene prvé,
2. ponecháva dnešné zobrazenie ako **kompaktné** (zdrojový → cieľový jazyk), ktoré si editor zapne prepínačom a voľba sa uloží k jeho účtu,
3. **nahrádza úpravu v bunke modálom**: kliknutie na bunku otvorí modál s kľúčom, jazykom, hodnotou základného jazyka ako nápovedou a poľom na preklad. Uloženie len tlačidlom. Úprava v riadku, uloženie na blur a Ctrl+Enter sa odstraňujú úplne.

Mimo rozsahu: hromadná úprava, história zmien, stav „Na kontrolu“, export, zmena poradia stĺpcov ťahaním.

### Potvrdené rozhodnutia (zo zadania, 2026-10-19)

- Kľúč je **preložený**, keď má hodnotu vo **všetkých** jazykoch projektu. Štatistiky hore (Preložené / Chýbajúce) v rozšírenom zobrazení rátajú kľúče podľa tohto pravidla.
- Filter stavu **Nepreložené** v rozšírenom zobrazení = riadok s aspoň jednou prázdnou bunkou.
- Vyhľadávanie v rozšírenom zobrazení hľadá v kľúči a v hodnotách **všetkých** jazykov.
- Poradie jazykových stĺpcov: základný jazyk prvý, potom ako v nastaveniach projektu (dnes `isBase desc, tag asc` z `GET …/languages`).
- Modál ukazuje hodnotu základného jazyka ako nápovedu aj v rozšírenom zobrazení.
- Prepínač zobrazenia **nie je v URL**. Je to preferencia používateľa, ktorá mu ostane aj po dlhom čase a na inom zariadení, preto sa ukladá **v databáze na `User`**, nie v localStorage.

## Rozhodnutia

### Dátový model

- `User.translationsView  TRANSLATIONS_VIEW @default(EXTENDED)`, enum `TRANSLATIONS_VIEW { EXTENDED COMPACT }` (migrácia `user_translations_view`). Žiadna iná zmena schémy: stav sa ďalej odvodzuje z hodnoty, nič sa neukladá.

### Kontrakt (`packages/shared/src/translations.ts`, `auth.ts`, `profile.ts`)

- `translationsViewSchema = z.enum(['EXTENDED', 'COMPACT'])`, `TranslationsView`.
- `authUserSchema` dostane `preferences: { translationsView }`, takže FE pozná voľbu hneď z `GET /api/auth/me` (cache `me` má `staleTime: Infinity`, mutácia ju prepíše).
- `updatePreferencesRequestSchema = { translationsView: translationsViewSchema }` → body `PATCH /api/profile/preferences`, odpoveď `Profile` (ako `PATCH /api/profile`).
- `translationsQuerySchema`: `sourceLanguageId` a `targetLanguageId` sú **voliteľné**, ale buď obidva, alebo žiadny (`refine`). S dvojicou platí **kompaktná sémantika** (stav, zoradenie, filter, štatistiky a vyhľadávanie podľa cieľového jazyka, vyhľadávanie aj v zdrojovom), bez nej **rozšírená sémantika** (všetky jazyky projektu). Zoznam `translationsSortSchema` ostáva; `UPDATED` radí v rozšírenom zobrazení podľa najnovšej zmeny v ktoromkoľvek jazyku.
- `translationListItemSchema` mení tvar: `source` a `target` nahrádza
  - `status: translationStatusSchema` – stav riadku podľa sémantiky dotazu,
  - `translations: z.record(z.uuid(), { value, status, updatedAt })` – bunka pre **každý** jazyk projektu (kľúč je `ProjectLanguage.id`; chýbajúci riadok = `{ value: null, status: 'UNTRANSLATED', updatedAt: null }`). Vracia sa vždy celá mapa, aj v kompaktnom zobrazení (10 jazykov × 50 riadkov je zanedbateľné a modál potrebuje hodnotu základného jazyka).
- `translationsResponseSchema.stats` ostáva `{ totalKeys, translated, untranslated }`; význam `translated` závisí od sémantiky dotazu (dokumentuje sa v JSDoc a v `docs/api/translations.md`).
- `updateTranslationResponseSchema` sa nemení.

### Backend (`translations.service.ts`, `profile.*`)

- `listTranslations`: podmienky a `ORDER BY` sa skladajú podľa režimu.
  - Kompaktný režim: dnešné SQL (dva `LEFT JOIN`), nezmenené.
  - Rozšírený režim: pomocné poddotazy nad `"ProjectLanguage" pl` projektu, napr. `missing = EXISTS (SELECT 1 FROM "ProjectLanguage" pl LEFT JOIN "Translation" t ON t."keyId" = k.id AND t."languageId" = pl.id WHERE pl."projectId" = k."projectId" AND t.value IS NULL)`; `UNTRANSLATED_FIRST` = `missing DESC, "group", k.name, k.id`; filter `status`; vyhľadávanie `k.name ILIKE … OR EXISTS (SELECT 1 FROM "Translation" t WHERE t."keyId" = k.id AND t.value ILIKE …)`; `UPDATED` = `(SELECT max(t."updatedAt") …) DESC NULLS LAST`; štatistiky `count(*) FILTER (WHERE NOT missing)`.
  - Bunky stránky sa načítajú druhým dotazom `prisma.translation.findMany({ where: { keyId: { in: ids } } })` a poskladajú do mapy podľa `ProjectLanguage` projektu (prázdne bunky doplní služba). Jeden raw dotaz s `json_object_agg` nie je potrebný.
- `PATCH /api/profile/preferences` v `profile.routes.ts` (auth už rieši router), služba `updatePreferences`, `GET /api/auth/me` a `GET /api/profile` vracajú `preferences`.
- Integračné testy: rozšírená sémantika (stav riadku, zoradenie, filter, vyhľadávanie v treťom jazyku, štatistiky), kompaktná sémantika nezmenená, `400 VALIDATION_ERROR` pri jednom jazyku z dvojice, preferencie (`PATCH`, `me`).

### Frontend

- **Modál `EditTranslationModal`** (`components/EditTranslationModal/`, rám `AppModal`): hlavička „Upraviť preklad“, kľúč (monospace) s popisom kľúča, jazyk s vlajkou a názvom, blok **Základný jazyk** s hodnotou základného jazyka iba na čítanie (`PluralForms` pri plurálovom kľúči; skrytý, keď sa upravuje samotný základný jazyk), pole(-ia) `TokenEditor` (jedno pre bežný kľúč, po formách pre plurálový), skrytá nápoveda o zamknutých tokenoch a `#`, chybová správa pod poľom, tlačidlá **Zrušiť** a **Uložiť** (loading počas ukladania). Validácia a chyby sa prenesú z `TranslationEditor` jedna k jednej: prázdny text → `null`, vyvážené zátvorky formy, limit `TRANSLATION_VALUE_MAX_LENGTH`, `PLACEHOLDER_MISMATCH` s chýbajúcimi a nadbytočnými premennými, `VALIDATION_ERROR` na `value`. Esc a Zrušiť zatvoria bez požiadavky. Po uložení sa modál zavrie, fokus sa vráti na bunku a živý región oznámi uloženie. `TranslationEditor` sa zmaže aj s CSS a testami.
- **Bunka** je tlačidlo (`TranslationCell`): zobrazuje hodnotu alebo zástupný text, červené pozadie `--app-color-untranslated-bg` len pri `UNTRANSLATED`, prístupné meno „{{key}}, {{language}}“. Platí v oboch zobrazeniach (v kompaktnom len cieľová bunka; červený riadok sa ruší).
- **`TranslationsTable`** dostane `view` a `languages`:
  - rozšírené: stĺpce Kľúč (sticky vľavo, `position: sticky; left: 0`, pozadie a jemný tieň pri scrolle), jeden stĺpec na jazyk (hlavička: vlajka + tag + natívny názov, pevná šírka ~16 rem), Stav (sticky vpravo). Tabuľka má `width: max-content`, obal `overflow-x: auto`. Skupinový riadok (`colSpan`) drží text v `<span>` so `position: sticky; left`, aby nezmizol pri scrolle. Skeleton a stavové riadky používajú `colSpan = 2 + languages.length`.
  - kompaktné: dnešné štyri stĺpce, cieľová bunka otvára modál.
  - `item.status` z API ide priamo do odznaku; `translations[languageId]` do buniek.
- **Prepínač zobrazenia** v `TranslationsToolbar`: `SegmentedControl` s **Všetky jazyky** / **Zdroj → cieľ** (texty v i18n), hodnota z `me.preferences.translationsView`, zmena cez `useUpdatePreferencesMutation` (optimisticky prepíše `me` a `PROFILE`, pri chybe vráti a ukáže notifikáciu). Výbery zdrojového a cieľového jazyka sa zobrazia len v kompaktnom zobrazení; `source`/`target` v URL ostávajú a v rozšírenom zobrazení sa ignorujú.
- `TranslationsPage`: `listQuery` podľa zobrazenia (bez jazykov v rozšírenom), `useUpdateTranslationMutation` optimisticky prepisuje `translations[languageId]`, `status` riadku a `stats` podľa toho, či sa riadok stal kompletným alebo prestal byť (v rozšírenom) alebo podľa cieľovej bunky (v kompaktnom).
- i18n `sk`, `cs`, `en`: `translationsPage.view.*`, `translationsPage.editModal.*`; texty editora `translationsPage.editor.hint` a ostatné, ktoré sa už nepoužijú, sa odstránia.

### Testy a dokumentácia

- Unit: `TranslationsPage.test.tsx` – prepísať ~16 prípadov o blur/Ctrl+Enter/Esc na modál (otvorenie z bunky, uloženie tlačidlom, Zrušiť bez požiadavky, chyby, plurály), doplniť rozšírené zobrazenie (stĺpce podľa jazykov, červená bunka, sticky triedy, prepínač ukladá preferenciu), kompaktné po prepnutí.
- E2E: `translation-edit.spec.ts` (modál), `translations.spec.ts` a `translations-flow.spec.ts` (predvolené je rozšírené; kroky so zdroj → cieľ najprv prepnú zobrazenie), `api-smoke.spec.ts` (`GET …/translations` bez jazykov, `PATCH /api/profile/preferences`), `accessibility.spec.ts` (axe na oboch zobrazeniach a otvorenom modále), `key-editing.spec.ts` skontrolovať (ceruzka pri kľúči ostáva).
- Docs: `docs/api/translations.md`, `docs/api/profile.md`, `docs/api/auth.md` (`preferences`), `docs/database.md` (enum a stĺpec), `docs/frontend.md` (komponenty, hooky, zobrazenia), `docs/overview.md`, `AGENTS.md` (doménová tabuľka: stav riadku), `docs/changelog.md`.

## Kroky

Postup podľa `.agents/workflows/feature.md`: vetva `feature/translations-views`, kontrakt najprv, BE a FE vo vlastných worktree, po každom kroku `pnpm verify`, docs, commit a krátky report. Každý krok necháva `main` zelený.

| #   | Krok                                                                                                                                                                                                                                                        | Overenie                                                                                                                                                                  | Odhad          |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| 1   | **Kontrakt + backend**: schémy v `shared` (nový tvar položky, voliteľná dvojica jazykov, `preferences`), migrácia `user_translations_view`, `listTranslations` v oboch režimoch, `PATCH /api/profile/preferences`, `me`/`profile` s `preferences`. FE sa iba prispôsobí novému tvaru položky (zdroj/cieľ z `translations`), správanie sa nemení. | `pnpm verify` (unit `shared`, integračné testy BE), `api-smoke` na `GET …/translations` s dvojicou aj bez nej a na `PATCH …/preferences`, `docs/api/*`, `database.md`     | 1 session      |
| 2   | **Modál namiesto úpravy v bunke**: `EditTranslationModal`, `TranslationCell`, odstránenie `TranslationEditor`, červené pozadie len na bunke, prepis unit testov editora, i18n.                                                                           | `pnpm verify`, unit testy stránky, ručná kontrola v `pnpm dev` (plurálový kľúč, `PLACEHOLDER_MISMATCH`, fokus po zatvorení), `frontend.md`                               | 1 session      |
| 3   | **Rozšírené zobrazenie a prepínač**: stĺpce podľa jazykov, sticky Kľúč a Stav, horizontálny scroll, skupinové riadky, `SegmentedControl` s uložením preferencie, kompaktné zobrazenie po prepnutí, optimistická aktualizácia štatistík.                   | `pnpm verify`, unit testy oboch zobrazení, ručná kontrola so Stoodio projektom (9 jazykov) na šírke 1280 px a 1920 px, tmavý režim, `frontend.md`                        | 1 až 1,5 session |
| 4   | **E2E, prístupnosť, dokumentácia**: prepis E2E specov, axe na oboch zobrazeniach a modále, revízia `accessibility-reviewer`, `code-reviewer`, changelog, `overview.md`, `AGENTS.md`.                                                                       | `pnpm test:e2e` proti `pnpm stack:up`, `pnpm verify`, bez `high` nálezov review                                                                                           | 0,5 až 1 session |

Spolu približne 4 až 4,5 session.

### Stav

- **Krok 1 (2026-10-19): hotový.** Kontrakt (`translationCellSchema`, `status` + `translations` v položke, voliteľná dvojica jazykov so sémantikou zobrazenia, `userPreferencesSchema`, `updatePreferencesRequestSchema`), migrácia `user_translations_view`, `listTranslations` v oboch režimoch, `PATCH /api/profile/preferences`, `preferences` v `me` a profile; FE adaptér (tabuľka a optimistická mutácia čítajú bunky z mapy). E2E `api-smoke.spec.ts` a `e2e/support/translations.ts` ešte používajú starý tvar položky, prepíšu sa v kroku 4.
- **Krok 2 (2026-10-19): hotový.** `EditTranslationModal` (kľúč, jazyk, hodnota základného jazyka, `TokenEditor` po formách, Zrušiť / Uložiť), `TranslationCell` (červené pozadie len na bunke), `TranslationValue`; `TranslationEditor` zmazaný, uloženie na blur a Ctrl+Enter odstránené, unit testy prepísané, i18n `translationsPage.editModal.*`. `TokenEditor` dostal `modalAutofocus` (fokus cez focus trap Mantine, aby sa po zatvorení vrátil na bunku). E2E `translation-edit.spec.ts` a `key-editing.spec.ts` sa prepíšu v kroku 4.
- **Krok 3 (2026-10-19): hotový.** Prepínač **Všetky jazyky** / **Zdroj → cieľ** (`SegmentedControl`) uložený cez `useUpdatePreferencesMutation` do `User.translationsView`; rozšírená tabuľka so stĺpcom na jazyk, sticky Kľúč a Stav, vodorovný scroll, sticky text skupiny; výbery jazykov len v kompaktnom zobrazení; unit testy oboch zobrazení a prepínača; ručne overené v dev aplikácii (3 jazyky, svetlý aj tmavý režim). Otvorené z rizík: tieň sticky stĺpca je nahradený 1 px čiarou; plurálové formy v bunke sa zobrazujú celé (bez skrátenia na `other`), pri 9 jazykoch to treba posúdiť na reálnych dátach.
- **Krok 4 (2026-10-19): prebieha.** E2E prepísané a zelené v Chromium aj WebKit (302 testov, testy prepínača bežia ako nový ADMIN, lebo preferencia je na používateľovi); axe bez porušení na oboch zobrazeniach a modáloch; code review bez nálezu `high`, stredné a nízke zapracované (mŕtvy `focusOnMount`, nepoužitý `ref`, vypnutý prepínač počas ukladania, docs). Kontrola prístupnosti podľa checklistu `accessibility-reviewer` beží; merge do `main` až po potvrdení.

## Riziká

- **Sticky stĺpce** v Mantine `Table` s `table-layout: fixed`: `position: sticky` funguje na `th`/`td`, ale skupinový riadok s `colSpan` potrebuje sticky vnútorný `<span>`, a tieň oddeľujúci sticky stĺpec od scrollujúceho obsahu treba riešiť pseudo-prvkom. Overiť v Chromium aj WebKit (Playwright beží v oboch).
- **Výkon**: 50 riadkov × 9 jazykov = 450 tlačidiel s `TranslationText`; v poriadku, ale `PluralForms` v každej bunke plurálového kľúča môže byť ťažšie – v bunke zobraziť len formu `other` a ostatné až v modále (rozhodnutie v kroku 3 podľa dojmu).
- **Zmena tvaru položky** rozbije FE testy a E2E naraz; preto krok 1 obsahuje minimálny FE adaptér, aby `main` ostal zelený, a E2E sa prepisujú až v kroku 4 (medzitým môžu E2E prekladov zlyhávať na vetve, nie na `main`).

## Otvorené

- Má sa prepínač zobrazenia ukázať aj v **Môj profil → Predvoľby** (`PreferencesSection`)? Navrhujem zatiaľ nie, len v toolbare prekladov.
- Šírka jazykového stĺpca (navrhujem 16 rem) a či má Kľúč v rozšírenom zobrazení ostať s popisom a skupinou pod sebou, alebo sa zúžiť.
