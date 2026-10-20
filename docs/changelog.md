---
title: 'Changelog'
updated: 2026-10-20
notion_page_id:
---

# Changelog

## Po fáze 1

### Prehľad projektu – zápis udalostí (2026-10-20)

- databáza: nová tabuľka `ActivityEvent` (enum `ACTIVITY_TYPE`), migrácia `activity_event` doplnila každému projektu udalosť `PROJECT_CREATED` ([Databáza](./database.md#activityevent), [ADR 0005](./decisions/0005-activity-events.md))
- backend: vytvorenie projektu, zmena nastavení a základného jazyka, pridanie a odobratie jazyka, pridanie, odobratie a odchod člena, import, úprava kľúča a prekladu zapíšu v tej istej transakcii jednu udalosť so snímkou údajov; nezmenená hodnota ani nezmenené nastavenia nezapíšu nič. API odpovede sa nemenia, čítacie endpointy prídu v ďalšom kroku
- shared: `ACTIVITY_TYPE` a `activityEventDataSchema` (payload podľa typu) v `packages/shared/src/activity.ts`
- seed: vzorová aktivita seedovaného projektu za posledných 30 dní ([Databáza](./database.md#seed))

### Stav prekladu na stránke Jazyky (2026-10-20)

- API: `GET` a `PUT …/languages/order` vracajú pri každom jazyku `translatedCount` a `keyCount` ([API](./api/project-languages.md#položka-zoznamu-languagelistitem))
- frontend: tabuľka jazykov má stĺpce **Preložené** (`221 / 248`) a **Pokrytie** (progres a percento) podľa Figmy `3:860`, bez stĺpca Na kontrolu; pod 1200 px a 640 px sa stĺpce presúvajú pod progres a pod názov jazyka, stránka sa už neposúva vodorovne ([Frontend](./frontend.md#stránka-jazyky-projektu))

### Export do XLSX a import iba pre adminov (2026-10-20)

- API: `GET /api/projects/:projectId/export?format=XLSX` vráti `translations.xlsx` s jedným hárkom `Namespace | Key | <jazyky>`, nepreložené ako prázdna bunka, streamované cez `exceljs` ([API](./api/exports.md#odpoveď-200-xlsx)); záťažové testy aj pre XLSX ([Testovanie](./testing.md#záťažové-testy-exportu))
- API: import (`POST …/imports/preview` aj `POST …/imports`) smie iba `ADMIN`, člen s rolou `EDITOR` dostane 403 `FORBIDDEN` ([API](./api/imports.md)); export ostáva pre každého člena
- frontend: v modáli exportu sa dá vybrať **XLSX**; tlačidlo **Importovať** (hlavička aj prázdny stav tabuľky) vidí iba `ADMIN`, editor v prázdnom stave dostane text, že kľúče pridá administrátor ([Frontend](./frontend.md#modál-exportovať-preklady))

### Export prekladov do CSV – E2E a review (2026-10-20)

- testy: E2E `export.spec.ts` (Chromium aj WebKit): stiahnutie `translations.csv`, presný obsah, opätovný import bez zmien, filter Nepreložené s vlastným názvom súboru, zablokovaný export; modál exportu v axe kontrole (predvolený stav, chyby polí, zoznam 422)
- API: export blokuje aj namespace, ktorý `convert-csv-to-json` prečíta inak (`a--b`, `x-`), kódom `NAMESPACE`; filter stavu sa vyhodnocuje nad dávkou v JS namiesto korelovaného poddotazu ([API](./api/exports.md))
- frontend: modál exportu po chybe presunie fokus na hlásenie, pri neplatnom formulári na prvé neplatné pole, po otvorení na kartu CSV; kontrast popisov, prípony `.csv` a nezaškrtnutého štvorčeka jazyka ([Frontend](./frontend.md#modál-exportovať-preklady))

### Export prekladov do CSV – frontend (2026-10-20)

- frontend: tlačidlo **Exportovať** v hlavičke stránky Preklady otvára modál **Exportovať preklady** (Figma 3:2768): formát CSV (JSON, XLSX, ARB neaktívne „Čoskoro“), jazyky (predvolene všetky), stav, názov súboru (predvolene `translations`), zoznam hodnôt, ktoré export zablokovali ([Frontend](./frontend.md#modál-exportovať-preklady))

### Export prekladov do CSV – záťažové testy (2026-10-20)

- testy: k6 záťažové testy exportu proti samostatnému stacku s 2 replikami po 2 GB (`scripts/load/`): 1, 3, 100 súbežných, projekt s 50 000 kľúčmi, 3 vlny po 100 a prerušené sťahovania; pamäť repliky max. 280 MiB, žiadny leak ani 5xx ([Testovanie](./testing.md#záťažové-testy-exportu))
- backend: export klienta, ktorý odíde ešte pred štartom exportu, už nedrží slot navždy; kontrola hodnôt končí pri odpojení klienta; log `Export finished` s trvaním, počtom kľúčov a heapom ([API](./api/exports.md#ako-sa-odpoveď-tvorí))

### Export prekladov do CSV – ochrana proti záťaži (2026-10-20)

- API: najviac `EXPORT_MAX_CONCURRENT` (2) exportov naraz na proces, ďalšie čakajú vo fronte (`EXPORT_QUEUE_MAX` 20, `EXPORT_QUEUE_TIMEOUT_MS` 10 s), potom 429 `EXPORT_BUSY` s `Retry-After`; export po `EXPORT_TIMEOUT_MS` (60 s) zavrie spojenie; slot sa uvoľní aj po chybe a odpojení ([API](./api/exports.md#súbežné-exporty), [ENV](./local-development.md))
- Docker: backend beží s `NODE_OPTIONS=--max-old-space-size=1536` (limit podu 2 GB) ([architektúra](./architecture.md#docker-služby))

### Export prekladov do CSV – backend (2026-10-20)

- API: `GET /api/projects/:projectId/export?languageIds=…&status=ALL|TRANSLATED|UNTRANSLATED` streamuje CSV vo formáte GoodRequest `i18nextJsonToCsv` (nepreložené `null`, jazyky v poradí projektu, namespace a kľúče podľa bajtov) z jedného snímku DB po dávkach 1 000 kľúčov ([API](./api/exports.md))
- API: hodnoty s `;`, novým riadkom alebo `--x--` export zablokujú: 422 `EXPORT_VALUE_UNSAFE` so zoznamom kľúčov a jazykov; cudzí jazyk 400 `EXPORT_LANGUAGES_INVALID`
- backend: chyba po začatí streamovanej odpovede sa zaloguje a spojenie sa zavrie (predtým by error middleware zlyhal na už odoslaných hlavičkách)

### Projekty: dátum vytvorenia a počet členov (2026-10-20)

- API: položka `GET /api/projects` (a `201 POST /api/projects`) má `memberCount` a `createdAt` ([API](./api/projects.md#get-apiprojects))
- frontend: zoznam projektov na indexe ukazuje dátum vytvorenia pod slugom a počet členov pod počtom kľúčov; na úzkej obrazovke je dátum pri počtoch ([Frontend](./frontend.md))

### Jazyky: poradie a základný jazyk presunom (2026-10-20)

- API: `PUT /api/projects/:projectId/languages/order` uloží poradie jazykov projektu, prvý jazyk sa stane základným; `GET …/languages` vracia jazyky v tomto poradí (základný vždy prvý), nový jazyk ide na koniec ([API](./api/project-languages.md#put-apiprojectsprojectidlanguagesorder), [databáza](./database.md#projectlanguage))
- frontend: na stránke Jazyky sa jazyky presúvajú myšou alebo šípkami, poradie určuje stĺpce v prekladoch; presun na prvé miesto sa potvrdzuje v modáli **Zmeniť základný jazyk**, **Nie** ho vráti ([Frontend](./frontend.md#stránka-jazyky-projektu))
- frontend: názvy jazykov na stránke Jazyky sú v jazyku aplikácie (napr. „Bulharčina“), popis pod nimi ostáva pôvodný názov a tag

### Členovia: úzka obrazovka (2026-10-20)

- frontend: Členovia na úzkej obrazovke: počet projektov, dátum a na telefóne aj rola sú pod e-mailom, e-mail sa láme pred `@` ([Frontend](./frontend.md#stránka-členovia))

### Preklady: premenné podľa názvu kľúča (2026-10-20)

- API: `PUT …/translations/:languageId` pri chýbajúcej hodnote základného jazyka porovná premenné s názvom kľúča, takže preklad bez `{{symbol}}` pri kľúči `Cena ({{symbol}})` vráti 400 `PLACEHOLDER_MISMATCH` ([API](./api/translations.md))

### Preklady: filtre jazykov, autora, obdobia a plurálov (2026-10-20)

- API: `GET …/translations` má filtre `updatedById`, `updatedWithin` (`DAY` / `WEEK` / `MONTH`), odpoveď má `editors` ([API](./api/translations.md#get-apiprojectsprojectidtranslations))
- API: preferencia `translationsLayout` (`COLUMNS` / `STACKED`), `PATCH /api/profile/preferences` prijme ľubovoľnú z preferencií ([API](./api/profile.md#patch-apiprofilepreferences), [databáza](./database.md))
- frontend: v zobrazení **Všetky jazyky** výber zobrazených jazykov (`?languages=`), základný jazyk ostáva vždy, stav a štatistiky sa nemenia ([Frontend](./frontend.md))
- frontend: filtre **Upravil** a **Zmenené** v druhom riadku toolbaru a prepínač **Len preklady** (skryje stĺpce Kľúč a Stav, viac miesta na jazyky na mobile) ([Frontend](./frontend.md))
- frontend: rozloženie (jazyky vedľa seba / pod sebou) je preferencia používateľa namiesto URL parametra `layout` ([Frontend](./frontend.md))
- frontend: názvy jazykov v tabuľke, modáli a výbere jazykov sú v jazyku aplikácie (napr. „bulharčina“ namiesto „български“) ([Frontend](./frontend.md))
- frontend: toolbar prekladov je prilepený iba od 62 em, na mobile sa odroluje ([Frontend](./frontend.md))
- frontend: vyhľadávanie je vždy vľavo v prvom riadku toolbaru, na mobile prvé; výber Kľúčov na stranu má výšku tlačidiel stránkovania, stránkovanie sa na mobile zmestí
- frontend: toolbar v dvoch plných riadkoch (vyhľadávanie, zobrazenie, jazyky a Len preklady; filtre), odznaky vybraných jazykov s vlajkou ([Frontend](./frontend.md))
- frontend: v tabuľke prekladov prerušované čiary medzi jazykovými stĺpcami a odznak **Základný** pri základnom jazyku; prepínač Len preklady má kurzor pointer ([Frontend](./frontend.md))
- frontend: modál Upraviť preklad nemá blok Jazyk; pri labeloch Základný jazyk a Preklad je pred labelom vlajka (16 px) a za ním tlmene v zátvorke názov jazyka, oba boxy majú 42 px ([Frontend](./frontend.md))

### Preklady: hustejšia tabuľka a počet na stranu (2026-10-20)

- frontend: zobrazenie **Všetky jazyky** má menšie paddingy, užšie stĺpce (14 rem) a text prekladu 14 px ([Frontend](./frontend.md))
- frontend: preklad v bunke sa skráti na 2 riadky (predtým 3) ([Frontend](./frontend.md))
- frontend: pri stránkovaní výber **Kľúčov na stranu** 25 / 50 / 100 (predvolené 25, v URL `pageSize`) ([Frontend](./frontend.md))

### Zoznam projektov: kľúče, progress a vlajky (2026-10-20)

- API: položka `GET /api/projects` (aj `201 POST`) má `languageTags` (základný jazyk prvý), `keyCount` a `translatedCount` ([API](./api/projects.md#get-apiprojects))
- API: `PATCH /api/admin/users/:id` mení aj `email` (voliteľné spolu s `role`, 409 `EMAIL_TAKEN`) ([API](./api/admin-users.md#patch-apiadminusersid))
- frontend: na detaile používateľa ADMIN upraví email (ikona pri emaile, modál **Upraviť e-mail**) a zmaže používateľa (**Odstrániť používateľa**, nie pri vlastnom účte) ([Frontend](./frontend.md#stránka-detail-používateľa))
- frontend: Používatelia na úzkej obrazovke: počet projektov, dátum a na telefóne aj rola sú pod emailom, email sa láme pred `@` ([Frontend](./frontend.md))
- frontend: Projekty (správa) bez stĺpca Základný jazyk; na úzkej obrazovke sú slug, počty a dátum pod názvom projektu ([Frontend](./frontend.md))
- frontend: detail používateľa na úzkej obrazovke: rola sa zalomí pod email, v tabuľke projektov sú slug a dátum pod názvom ([Frontend](./frontend.md))
- frontend: menu používateľa v hornej lište sa otvára kliknutím na celý blok s menom, tlačidlo `⋯` je preč ([Frontend](./frontend.md))
- frontend: riadok projektu na indexe ukazuje počet kľúčov, progress Preložené / Nepreložené cez všetky jazyky a vlajky jazykov; stránka je širšia (1180 px) ([Frontend](./frontend.md#zoznam-projektov))

### Preklady: automatické rozpoznanie plurálov (2026-10-20)

- API: `PUT /api/projects/order` uloží vlastné poradie projektov používateľa (tabuľka `ProjectOrder`, nová migrácia), `GET /api/projects` ho vracia v tomto poradí ([API](./api/projects.md#put-apiprojectsorder), [Databáza](./database.md#projectorder))
- frontend: projekty na indexe sa dajú preradiť potiahnutím úchytu (SortableJS s animáciou, ostatné riadky sa odsúvajú) alebo šípkami ([Frontend](./frontend.md#zoznam-projektov))
- frontend: Nový projekt má pri Jazykoch **Vybrať všetky** / **Zrušiť výber**, vlajky vo vybraných jazykoch a krížik na zmazanie výberu; text vo výbere jazykov je zvislo vycentrovaný ([Frontend](./frontend.md#zoznam-projektov))
- frontend: modál Upraviť preklad má pri základnom jazyku tlačidlo **Prevziať zo základného jazyka**, ktoré vloží jeho text (aj plurálové formy) do poľa ako východisko pre formát ([Frontend](./frontend.md#modál-upraviť-preklad))
- API: import nastaví kľúču `pluralVariable`, keď sú jeho hodnoty ICU plurálové správy s jednou premennou (nový kľúč aj existujúci bez plurálu, z uložených aj súborových hodnôt); správu obalenú textom (Tolgee) zapíše ako čistú plurálovú správu s textom v každej forme ([API](./api/imports.md))
- frontend: plurálový editor ponúka iba formy, ktoré používajú celé čísla (v sk a cs bez `many`, tá je iba pre desatinné čísla); uložená forma sa zobrazí vždy
- API aj frontend: ICU argument `{name}` je premenná ako `{{name}}` (chip v tabuľke a editore, kontrola premenných pri ukladaní a v preview importu) ([API](./api/translations.md))
- frontend: Upraviť kľúč pri takom kľúči otvorí plurál zapnutý s predvyplnenou premennou ([Frontend](./frontend.md#modál-upraviť-kľúč))

### Preklady: posledná úprava, Uložiť a ďalší, vymazanie vyhľadávania (2026-10-20)

- API: bunka prekladu v zozname aj odpoveď `PUT …/translations/:languageId` nesú `updatedBy` (`{ id, name }` alebo `null`) ([API](./api/translations.md))
- frontend: modál Upraviť preklad ukazuje, kto a kedy preklad naposledy uložil, a má **Uložiť a ďalší** (aj `Cmd/Ctrl+Enter`), ktoré otvorí ďalšiu nepreloženú bunku na strane ([Frontend](./frontend.md#modál-upraviť-preklad))
- frontend: vyhľadávanie má X na vymazanie, `Esc` ho tiež vymaže ([Frontend](./frontend.md#stránka-preklady))

### Preklady: vyhľadávanie bez diakritiky (2026-10-20)

- API: `search` v `GET /api/projects/:projectId/translations` ignoruje diakritiku cez rozšírenie PostgreSQL `unaccent` (nová migrácia), „vlastni“ nájde „vlastní“ ([API](./api/translations.md), [Databáza](./database.md#migrácie))

### Preklady: jazyky pod sebou (2026-10-20)

- frontend: prepínač rozloženia v toolbare oboch zobrazení (ikony, URL `?layout=STACKED`); **Jazyky pod sebou** ukáže tabuľku s dvomi stĺpcami Kľúč a Preklady, jazyky pod sebou (vo **Všetky jazyky** všetky, v **Zdroj → cieľ** zdroj a cieľ) a stav pri kľúči ([Frontend](./frontend.md#stránka-preklady))

### Zmena roly používateľa v detaile (2026-10-20)

- API: `PATCH /api/admin/users/:id` s `{ role }` zmení globálnu rolu, posledný `ADMIN` ostáva (409 `LAST_ADMIN`) ([API](./api/admin-users.md#patch-apiadminusersid))
- frontend: karta na Detail používateľa má namiesto odznaku select **Rola**, ktorý sa uloží hneď pri zmene ([Frontend](./frontend.md#stránka-detail-používateľa))

### Profil: jazyk ako v hornej lište a vlastná rola (2026-10-19)

- frontend: **Jazyk rozhrania** na Môj profil je `LanguageSwitcher` vo variante `form`, takže má v možnostiach vlajky ako prepínač v hornej lište ([Frontend](./frontend.md#stránka-môj-profil))
- API: `PATCH /api/profile` prijme voliteľné `role`; inú rolu môže poslať iba `ADMIN` (403 `FORBIDDEN`) a nie posledný (409 `LAST_ADMIN`) ([API](./api/profile.md#patch-apiprofile))
- frontend: v Osobných údajoch nahradil disabled **Pracovná pozícia** select **Rola** (Administrátor / Editor); `ADMIN` si ju môže zmeniť, `EDITOR` ju vidí disabled
- frontend: blok používateľa s menu `⋯` je v hornej lište na každej prihlásenej stránke (ako na zozname projektov), zo sidebaru zmizol ([Frontend](./frontend.md#používateľ-v-hornej-lište-usermenu))

### Členovia projektu ako tabuľka používateľov (2026-10-19)

- API: `ProjectMember` v `GET /api/projects/:projectId/members` a `201 POST` nesie aj `role` a `projectCount` ([API](./api/projects.md#členovia))
- frontend: tabuľka Členovia má stĺpce Rola a Projekty ako Používatelia (vidí ich aj člen) a pre `ADMIN` odkaz Otvoriť do detailu používateľa; rola `EDITOR` sa v UI volá **Editor** namiesto „Člen“ ([Frontend](./frontend.md#stránka-členovia))

### Zobrazenia prekladov, krok 4: E2E, review a prístupnosť (2026-10-19)

- E2E: `translation-edit.spec.ts` (modál), `translations.spec.ts` (rozšírené zobrazenie, sticky stĺpce, prepínač uložený na účet), `translations-flow.spec.ts`, `key-editing.spec.ts`, `import.spec.ts`, `api-smoke.spec.ts` (oba režimy zoznamu, `PATCH /api/profile/preferences`), `accessibility.spec.ts` (obe zobrazenia a modál Upraviť preklad); testy prepínača sa prihlasujú ako nový ADMIN ([Testovanie](./testing.md))
- review: odstránený nepoužitý `focusOnMount` a `ref`, prepínač zobrazenia je počas ukladania vypnutý, dokumentácia bez „úpravy v riadku“

### Zobrazenia prekladov, krok 3: rozšírené zobrazenie a prepínač (2026-10-19)

- frontend: nové predvolené zobrazenie **Všetky jazyky** – stĺpec na každý jazyk projektu, vodorovný scroll, stĺpce Kľúč a Stav zafixované na okrajoch, červená len bunka bez prekladu, riadok je Nepreložené, kým chýba hoci jeden jazyk; dnešné zobrazenie **Zdroj → cieľ** ostáva ako kompaktné; prepínač v toolbare sa ukladá na účet používateľa (`PATCH /api/profile/preferences`, hook `useUpdatePreferencesMutation`), nie do URL ([Frontend](./frontend.md#stránka-preklady))
- otvorené: E2E sa prepíšu v kroku 4 plánu ([plán](./plans/translations-views.md))

### Zobrazenia prekladov, krok 2: modál Upraviť preklad (2026-10-19)

- frontend: klik na bunku prekladu otvorí modál **Upraviť preklad** (kľúč s popisom, jazyk s vlajkou, hodnota základného jazyka ako nápoveda, pole s uzamknutými tokenmi po plurálových formách, Zrušiť / Uložiť); úprava v riadku, uloženie klikom mimo pole a Ctrl+Enter sú odstránené; validácia a chyby (`PLACEHOLDER_MISMATCH`, zátvorky, limit dĺžky) ostali; červené pozadie má len bunka bez prekladu, nie riadok ([Frontend](./frontend.md#modál-upraviť-preklad))
- `TokenEditor`: `modalAutofocus` – pole v modáli fokusuje focus trap Mantine, takže sa fokus po zatvorení vráti na bunku
- otvorené: E2E `translation-edit.spec.ts`, `key-editing.spec.ts` a `api-smoke.spec.ts` sa prepíšu v kroku 4 plánu

### Zobrazenia prekladov, krok 1: kontrakt a backend (2026-10-19)

- zdieľaný kontrakt: položka zoznamu prekladov nesie `status` riadku a `translations` (bunka pre každý jazyk projektu podľa `ProjectLanguage.id`) namiesto `source`/`target`; `sourceLanguageId` a `targetLanguageId` sú voliteľné (obidva alebo žiadny) a určujú zobrazenie: kompaktné (stav, filter, zoradenie, štatistiky a vyhľadávanie podľa cieľového jazyka) alebo rozšírené (riadok je preložený, keď má hodnotu každý jazyk; vyhľadávanie vo všetkých jazykoch); `preferences.translationsView` v `AuthUser` a `Profile`, `PATCH /api/profile/preferences` ([API](./api/translations.md), [profil](./api/profile.md))
- databáza: `User.translationsView` (enum `TRANSLATIONS_VIEW`, default `EXTENDED`, migrácia `user_translations_view`) ([Databáza](./database.md))
- backend: `listTranslations` skladá SQL podľa zobrazenia (`EXISTS` cez jazyky projektu v rozšírenom), bunky stránky načíta druhým dotazom; integračné testy oboch zobrazení a preferencií
- frontend: tabuľka a optimistická mutácia čítajú bunky z `translations` a stav riadku z `status`, správanie stránky sa nemení (plán: [`docs/plans/translations-views.md`](./plans/translations-views.md))

### Detail používateľa s jeho projektmi (2026-10-19)

- zdieľaný kontrakt: `adminUserDetailSchema = adminUserSchema.extend({ projects })`, položka projektu `adminUserProjectSchema { id, name, slug, primaryColor, joinedAt }`
- backend: `GET /api/admin/users/:id` vráti používateľa s jeho projektmi zoradenými podľa názvu (`404 NOT_FOUND` pre neznáme id), pridanie a odobratie projektu používa existujúce `POST` a `DELETE /api/projects/:projectId/members` ([API](./api/admin-users.md))
- frontend: stránka `/admin/users/$userId` (iba `ADMIN`) s kartou účtu (`UserCard`, `RoleBadge`), tabuľkou projektov s akciami Otvoriť členov a Odobrať z projektu (`UserProjectsTable`, `RemoveUserProjectModal`) a modálom Pridať do projektu so selectom projektov, v ktorých používateľ ešte nie je (`AddUserProjectModal`); riadok v tabuľke používateľov má akciu Otvoriť; kľúč `QUERY_KEYS.ADMIN.USER(id)` pod prefixom `ADMIN.USERS()` ([Frontend](./frontend.md#stránka-detail-používateľa))
- E2E: `user-detail.spec.ts` (otvorenie z tabuľky, pridanie a odobratie projektu, odkaz na členov, neznáme id, 403 pre člena)

### Členovia projektu z existujúcich používateľov (2026-10-19)

- zdieľaný kontrakt: `createUserRequestSchema` má povinné `role` (`ADMIN` / `EDITOR`), `adminUserSchema` má `projectCount`, `addProjectMemberRequestSchema { userId }` nahradil `createProjectMemberRequestSchema`, nový chybový kód `ALREADY_MEMBER` (409)
- backend: `GET /api/admin/users` vracia všetkých používateľov s počtom projektov, `POST` berie rolu, `DELETE` zmaže ktoréhokoľvek používateľa okrem vlastného účtu; `POST /api/projects/:projectId/members` pridá existujúceho používateľa (404 neznámy, 409 už člen) a spolu s `DELETE …/members/:userId` je iba pre `ADMIN` (člen 403), zoznam členov ostáva pre každého člena ([API](./api/admin-users.md), [projekty](./api/projects.md#členovia))
- frontend: Používatelia zobrazujú rolu a počet projektov, modál Nový používateľ má výber roly (predvolene Člen), Odstrániť používateľa uvádza počet projektov; Členovia projektu: tlačidlo Pridať člena a odobratie iba pre `ADMIN`, modál Pridať člena s vyhľadávacím selectom existujúcich používateľov a tlačidlom Vytvoriť nového používateľa (vytvorený sa predvyberie) ([Frontend](./frontend.md))
- E2E: `members.spec.ts` a `users.spec.ts` prepísané na nový tok, API smoke overuje 403 pre člena a 409 `ALREADY_MEMBER`; pomocné funkcie `createMember()` a `addMember()` v `e2e/support/users.ts`
- rozhodnutia: bez pozvánok emailom (používateľov zakladá admin s interným heslom), `LAST_MEMBER` sa nemení, detail používateľa s jeho projektmi je druhá časť plánu ([plán](./plans/project-members.md))

### Úprava kľúča, plurálové formy a zamknuté tokeny v editore (2026-10-19)

- zdieľaný kontrakt: `PATCH /api/projects/:projectId/keys/:keyId` (`updateTranslationKeyRequestSchema`: názov, popis, plurál s názvom premennej), `TRANSLATION_KEY_TAKEN` (409), ICU helpery plurálu (`parsePluralValue`, `serializePluralValue`, `pluralFormsForTag` z `Intl.PluralRules`), `description` a `plural` v položke zoznamu
- databáza: `TranslationKey.description` a `TranslationKey.pluralVariable` (migrácia `translation_key_meta`); plurálový kľúč ukladá na jazyk jednu ICU správu `{count, plural, one {…} other {…}}` ([Databáza](./database.md))
- backend: úprava kľúča len pre globálneho ADMIN-a (člen 403), premenovanie na obsadený názov v namespace 409; zapnutie plurálu presunie existujúci text do formy `other`, vypnutie ponechá `other`, premenovanie premennej správu preserializuje; oprava regexu premenných (`{{{name}}` v plurálovej forme) ([API](./api/translations.md))
- frontend: editor bunky je `contenteditable` s uzamknutými chipmi pre `{{premenné}}` aj HTML značky (kurzor ich preskakuje, Backspace/Delete ich zmaže celé, vloženie je čistý text); plurálový kľúč zobrazuje formy jazyka ako v Tolgee (One/Few/Many/Other) a edituje sa po formách; ikona ceruzky pri kľúči (ADMIN) otvára modál Upraviť kľúč (Kľúč, Popis, Použiť plurálové formy, Názov premennej) ([Frontend](./frontend.md))
- prístupnosť a E2E: skrytá nápoveda o zamknutých tokenoch a znaku `#`, tooltip ikony riadku aj pri fokuse z klávesnice; `key-editing.spec.ts` (chipy v oboch prehliadačoch, modál, plurály, API smoke `PATCH` kľúča, axe)
- otvorené: pri zapnutej ochrane premenných sa plurálová forma s `#` namiesto `{{count}}` odmietne (rozhodnutie produktu, či `#` počítať ako premennú); ADMIN má v riadku o jeden Tab stop navyše (ceruzka)

### Preklady a import: záverečné E2E, prístupnosť a dokumentácia (2026-10-19)

- E2E: `translations-flow.spec.ts` – celý tok import → pridanie chýbajúceho jazyka → preklad v riadku → filtre v URL → opakovaný import bez zmien; zdieľané pomocné funkcie stránky Preklady a modálu importu v `e2e/support/`
- prístupnosť stránky Preklady: stránkovanie nestráca fokus na krajných stranách (`aria-disabled`), oznámenie počtu výsledkov po vyhľadávaní a filtroch (živý región), chybový stav ako `role="alert"`, čas poslednej zmeny ako `<time>` s úplným dátumom, tmavší text odznakov stavu v svetlom režime; otvorené: žltá výplň progress baru Chýbajúce (netextový kontrast 1,7 : 1, rozhodnutie dizajnu)
- dokumentácia: prehľad, databáza, frontend, API a testovanie zosúladené s kódom, doménová tabuľka v `AGENTS.md` (limit kľúča v bajtoch, namespace, import), stav míľnikov v pláne

### Úprava prekladu v riadku (2026-10-19)

- zdieľaný kontrakt: `updateTranslationRequestSchema` (`{ value }`, max. 10 000 znakov, prázdny text = `null`), chybové kódy `PLACEHOLDER_MISMATCH` (400, `details { missing, extra }`) a `TRANSLATION_KEY_NOT_FOUND` (404)
- backend: `PUT /api/projects/:projectId/keys/:keyId/translations/:languageId` – upsert prekladu; pri zapnutom `protectVariables` porovná premenné `{{…}}` so základným jazykom (normalizácia zdieľaná s importom v `lib/placeholders.ts`) a nesúlad odmietne ([API](./api/translations.md))
- frontend: klik do bunky cieľového jazyka otvorí `Textarea`, uloží sa pri strate fokusu alebo Ctrl/Cmd+Enter, Esc zruší; optimistická aktualizácia hodnoty, stavu aj kariet s návratom pri chybe; nesúlad premenných sa zobrazí pod poľom a editor ostane otvorený ([Frontend](./frontend.md))
- E2E: `translation-edit.spec.ts`, API smoke `PUT` prekladu, axe s otvoreným editorom

### Import prekladov: modál (2026-10-19)

- frontend: tlačidlo Importovať na stránke Preklady otvára modál v dvoch krokoch – nahratie CSV (vlastná dropzone, kontrola prípony a veľkosti ešte pred odoslaním, checkbox Vytvoriť chýbajúce kľúče, zoznam chýb súboru s číslami riadkov) a kontrola (priradenie stĺpcov k jazykom projektu, Pridať jazyk priamo z riadku s automatickým opakovaním kontroly, Preskočiť, upozornenia na premenné, súhrn nových kľúčov a prekladov); po importe notifikácia so súhrnom a obnovenie zoznamu ([Frontend](./frontend.md))
- i18n: texty modálu a všetky kódy chýb a upozornení importu v sk, cs, en
- prístupnosť: fokus na nadpis kroku pri zmene kroku, pomenované tlačidlá po riadkoch, `aria-controls` pri rozbaľovaní upozornení, nové tokeny `--app-color-warning-bg/-text`
- E2E: `import.spec.ts` (vymyslené fixtures `e2e/fixtures/import-*.csv`), API smoke importu, axe oboch krokov modálu

### Správa projektov (2026-10-19)

- shared: kontrakt `adminProjectListItemSchema` / `adminProjectListResponseSchema`
- backend: `GET /api/admin/projects` (všetky projekty so základným jazykom, počtom jazykov a členov) a `DELETE /api/admin/projects/:projectId` (členstvá a jazyky kaskádou, používatelia ostávajú), iba ADMIN ([API](./api/admin-projects.md))
- frontend: stránka **Projekty** v sekcii SPRÁVA (`/admin/projects`, iba ADMIN, EDITOR dostane 403) s tabuľkou všetkých projektov (farba a názov, slug, základný jazyk, počet jazykov a členov, vytvorený), tlačidlom Nový projekt a akciami Upraviť (formulár nastavení v modáli), Otvoriť projekt a Zmazať (potvrdenie prepísaním slugu) ([Frontend](./frontend.md#stránka-projekty-správa))
- plán: [admin-projects.md](./plans/admin-projects.md)

### Import prekladov: zápis (2026-10-18)

- zdieľaný kontrakt: `KEY_TOO_LONG` počíta UTF-8 bajty (max. 2 000 B, 2 000 znakov v cyrilike sa nezmestilo do unikátneho indexu), namespace max. 100 znakov, chybový kód `IMPORT_COLUMNS_INVALID` (400)
- backend: `POST /api/projects/:projectId/imports` – priradenie stĺpcov k jazykom (alebo preskočenie), voliteľné vytvorenie chýbajúcich kľúčov, zápis v jednej transakcii s `pg_advisory_xact_lock` na projekt a dávkovým upsertom; `null` v súbore nikdy neprepíše vyplnený preklad, rovnaké hodnoty sa nemenia, opakovaný import = 0 zmien ([Import](./api/imports.md))
- výkon: 2 500 kľúčov × 10 jazykov (25 000 prekladov) za ~0,7 s

### Import prekladov: parser CSV a kontrola súboru (2026-10-18)

- zdieľaný kontrakt: `importPreviewRequestSchema`, `importPreviewResponseSchema`, `importRequestSchema` (pre ďalší krok), kódy `IMPORT_ISSUE_CODES`, chybové kódy `IMPORT_FILE_INVALID` (422, `details.issues`) a `IMPORT_FILE_TOO_LARGE` (413)
- backend: parser formátu GoodRequest i18nextJsonToCsv (`; `, sekcie `--namespace--`, `null` aj `""` = nepreložené) s chybami po riadkoch; `POST /api/projects/:projectId/imports/preview` spáruje stĺpce s jazykmi, porovná súbor s DB a vráti počty zmien a upozornenia, nič nezapisuje ([Import](./api/imports.md))
- limity: telo do 12 MB len na routách importu (inde 100 kB), obsah súboru do 10 MB, nginx `client_max_body_size 12m` pre `/api/`
- zistenie: 2 000-znakový kľúč v cyrilike sa do DB nezmestí (limit btree indexu), treba rozhodnúť pred zápisom importu

### Preklady: dátový model a zoznam na čítanie (2026-10-18)

- databáza: tabuľky `TranslationKey` (projekt, namespace, názov, unikátne v projekte + namespace) a `Translation` (kľúč + jazyk, `value` `null` = nepreložené), cascade z projektu, jazyka aj kľúča; seed pridá nový seedovaný projekt s ~30 vymyslenými kľúčmi v 2 namespace ([Databáza](./database.md))
- zdieľaný kontrakt: `translationsQuerySchema`, `translationsResponseSchema`, stavy `TRANSLATED` / `UNTRANSLATED` (odvodené, neukladajú sa)
- backend: `GET /api/projects/:projectId/translations` s vyhľadávaním (kľúč aj text), filtrom stavu a namespace, zoradením, stránkovaním a štatistikami pre cieľový jazyk ([API](./api/translations.md))
- frontend: stránka Preklady (`/projects/<slug>/translations`) ako prvá položka sidebaru a predvolená stránka projektu, karty štatistík, filtre v URL, zoskupenie podľa namespace a prefixu kľúča, nepreložené riadky s červeným pozadím; Importovať je zatiaľ neaktívne ([Frontend](./frontend.md))
- E2E: stránka Preklady, API smoke a axe kontrola v light aj dark režime

### Slug v URL projektu, čeština a akcie v tabuľkách (2026-10-18)

- frontend: projekt má v URL slug namiesto id (`/projects/<slug>/settings`), API ostáva na id; po zmene slugu v nastaveniach sa URL prepíše na nový ([Frontend](./frontend.md))
- frontend: čeština ako tretí jazyk rozhrania, prepínač jazyka v hornej lište je `Select` s vlajkami namiesto SK/EN prepínača
- frontend: zvonček notifikácií odstránený z hornej lišty, vráti sa s notifikáciami
- frontend: na stránkach Používatelia, Členovia a Jazyky sú akcie riadku explicitné ikony (kôš, odobratie člena) namiesto menu `⋯`

### Favicon a akcie v zozname projektov (2026-10-18)

- frontend: favicon s ružovým logom zo sidebaru; v zozname projektov namiesto menu `⋯` priamo ikony Nastavenia a Opustiť projekt ([Frontend](./frontend.md#zoznam-projektov))

### Jazyky na úrovni projektu (2026-10-18)

- databáza: tabuľka `ProjectLanguage` (tag a základný jazyk per projekt, čiastočný unikátny index na základný jazyk v projekte); migrácia `project_languages` skopírovala dovtedajšie globálne jazyky do každého projektu a zmazala tabuľku `Language` ([Databáza](./database.md))
- zdieľaný kontrakt: `languageTags` pri vytvorení projektu (aspoň jeden, prvý je základný), zrušená úprava názvov a vlajky jazyka
- backend: `GET`, `POST`, `DELETE /api/projects/:projectId/languages` pre členov aj ADMIN-a; `baseLanguageId` v nastaveniach projektu mení ktorýkoľvek člen; `/api/languages` a `/api/admin/languages` zrušené ([API](./api/project-languages.md))
- frontend: stránka Jazyky projektu (`/projects/$projectId/languages`, položka v sidebari projektu), výber jazykov v modáli Nový projekt, admin stránka `/languages` a modál Nastavenia jazyka zrušené
- E2E: jazyky v testovacích projektoch bez zdieľaného locku
- plán: [project-languages.md](./plans/project-languages.md)

### Odobratie člena a odstránenie admina (2026-10-18)

- backend: `DELETE /api/projects/:projectId/members/:userId` (člen aj ADMIN, účet ostane, posledného člena nejde odobrať) a `DELETE /api/admin/users/:id` (iba iného admina, nový kód `SELF_DELETE`)
- frontend: menu `⋯` s Odobrať z projektu na stránke Členovia a Odstrániť na stránke Používatelia, oboje s potvrdením; úprava člena nie je, meno sa mení v profile
- E2E: odobratie člena a odstránenie admina cez UI

### Projekty a členovia (MVP, 2026-10-18)

- organizácie vypadli: používateľ s rolou `EDITOR` (v UI „Člen“) spravuje svoje projekty sám, `ADMIN` vidí všetky
- zdieľaný kontrakt: `ProjectListItem`, `createProjectRequestSchema`, `ProjectMember`, `createProjectMemberRequestSchema`, `baseLanguageId` v nastaveniach projektu voliteľné, nové chybové kódy `SLUG_TAKEN` a `LAST_MEMBER`
- backend: `/api/projects` (zoznam, vytvorenie, opustenie, nastavenia, členovia) s prístupom pre člena alebo ADMIN-a (inak 404); `/api/admin/project` zrušené; `/api/admin/users` zobrazuje a vytvára iba adminov; zoznam jazykov presunutý na `GET /api/languages` pre každého prihláseného ([API](./api/projects.md))
- frontend: úvodná stránka so zoznamom projektov bez sidebaru (Nový projekt, Opustiť projekt, Nastavenia), routy `/projects/$projectId/settings` a `/members` so sidebarom, stránka Členovia, `/project-settings` zrušené
- E2E: testy projektov a členov, testovací používatelia sa zakladajú cez Členovia v testovacom projekte, `teardown` maže aj testovacie projekty
- plán: [projects.md](./plans/projects.md)

### Nastavenia projektu (MVP, 2026-10-17)

- zdieľaný kontrakt: `ProjectSettings`, `updateProjectSettingsRequestSchema` (názov, slug `a-z0-9` s pomlčkami, farba `#RRGGBB` uložená veľkými písmenami, ochrana premenných, základný jazyk)
- databáza: tabuľky `Project` a `ProjectMember`, seed jedného projektu `B2B Admin` / `b2b-admin` so seedovaným adminom ako členom iba do prázdnej tabuľky ([Databáza](./database.md))
- backend: `GET` a `PATCH /api/admin/project` iba pre ADMIN; zmena základného jazyka v tej istej transakcii cez spoločnú funkciu `setBaseLanguage` ([API](./api/projects.md))
- frontend: stránka `/project-settings` podľa Figmy doplnená o Základný jazyk a disabled tlačidlo Opustiť projekt, položka Nastavenia projektu v sekcii SPRÁVA sidebaru
- E2E: testy stránky (uloženie, základný jazyk, validácia, EDITOR 403, odhlásený), sidebar a axe s novou stránkou
- plán: [project-settings.md](./plans/project-settings.md)

### Jazyky (MVP, 2026-10-17)

- zdieľaný kontrakt: katalóg 9 podporovaných jazykov (`SUPPORTED_LANGUAGES`: bg, cs, de-AT, en, hr, hu, ro, ru, sk), `Language`, `createLanguageRequestSchema`, `updateLanguageRequestSchema`, nové chybové kódy `LANGUAGE_TAKEN` a `LANGUAGE_IS_BASE`
- databáza: tabuľka `Language` s čiastočným unikátnym indexom (najviac jeden základný jazyk), seed `sk` (základný) a `en` iba do prázdnej tabuľky ([Databáza](./database.md))
- backend: `GET`, `POST`, `PATCH`, `DELETE /api/admin/languages` iba pre ADMIN; prvý jazyk je základný, zmena základného jazyka v jednej transakcii, základný jazyk sa nedá odstrániť ([API](./api/admin-languages.md))
- frontend: stránka `/languages` podľa Figmy (bez stĺpcov štatistík prekladov), modaly Pridať jazyk, Nastavenia jazyka a potvrdenie odstránenia, kruhové vlajky z [circle-flags](https://github.com/HatScripts/circle-flags) (MIT)
- frontend: sidebar podľa Figmy (logo, Jazyky a Používatelia pre ADMIN, dole meno, rola a menu Môj profil / Odhlásiť sa), na úzkych obrazovkách cez burger; horná lišta už iba SK/EN, téma a zvonček
- E2E: testy stránky Jazyky (pridanie, úprava, základný jazyk, odstránenie s potvrdením, EDITOR 403, odhlásený) a API smoke pre `/api/admin/languages`
- plán: [languages.md](./plans/languages.md)

### Môj profil (MVP, 2026-10-17)

- zdieľaný kontrakt: `updateProfileRequestSchema` (meno a priezvisko povinné, max. 100 znakov, orezané), `Profile` s `passwordChangedAt`
- backend: `GET /api/profile` a `PATCH /api/profile` pre ADMIN aj EDITOR, mení iba meno a priezvisko prihláseného používateľa ([API](./api/profile.md))
- frontend: stránka `/profile` podľa Figmy, položka Môj profil v menu používateľa, úprava mena a priezviska (iniciály v hornej lište sa zmenia hneď), funkčný výber jazyka rozhrania; email, pracovná pozícia, fotografia, notifikácie a zmena hesla sú zatiaľ disabled
- E2E: testy stránky profilu (uloženie, validácia, disabled prvky, jazyk, obe role, 401) a API smoke pre `/api/profile`
- plán: [profile.md](./plans/profile.md)

## Fáza 1

Uzavretá 2026-10-16: všetky akceptačné kritériá splnené, vizuálnu zhodu stránky Používatelia a modálu s Figmou potvrdil Michal Bella.

### Míľnik C: Používatelia (2026-10-16)

- zdieľaný kontrakt: `createUserRequestSchema`, `AdminUser`, `adminUserListResponseSchema`
- backend: `GET /api/admin/users` (od najnovšieho, bez `passwordHash`) a `POST /api/admin/users` (vždy `EDITOR`, 409 `EMAIL_TAKEN` aj pri inej veľkosti písmen a súbehu), router `/api/admin` iba pre `ADMIN` ([API](./api/admin-users.md))
- frontend: stránka Používatelia podľa Figmy (tabuľka s iniciálami, dátum podľa jazyka, stavy loading/prázdny/chyba), modál Nový používateľ (chyby 400 a 409 pri poli, nedá sa odoslať dvakrát ani zavrieť počas odosielania), lazy načítanie stránok a vendor chunky (hlavný chunk 71 kB namiesto 763 kB), biely modál v theme
- E2E: testovací EDITOR vzniká cez `POST /api/admin/users`, poistka na lokálnu DB, nové testy stránky Používatelia a API (401, 403, 400, 409, CSRF)
- harness: nové skills `add-endpoint` a `add-page`, `api-smoke` a `testing` doplnené o správu používateľov

### Míľnik B: Prihlásenie (2026-10-16)

- zdieľaný kontrakt: `ROLE`, `loginRequestSchema`, `AuthUser`, `getInitials`
- backend: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, session v Postgrese (hash tokenu, sliding TTL 7 dní, absolútny limit 30 dní, posun cookie), globálna CSRF ochrana, rate limit loginu s `Retry-After`, `requireAuth` a `requireRole`, nové ENV (`COOKIE_SECURE`, `SESSION_*`, `LOGIN_RATE_LIMIT_*`), dev server počúva iba na `127.0.0.1` ([ADR 0004](./decisions/0004-db-session.md))
- frontend: prihlasovacia obrazovka podľa Figmy, horná lišta (logo, SK/EN, zvonček, menu používateľa), guardy rout, stránky 403 a všeobecnej chyby, placeholder `/admin/users` iba pre `ADMIN`
- E2E: Playwright balík (Chromium + WebKit, setup so `storageState` pre ADMIN a EDITOR), `pnpm test:e2e` reštartuje stack s vyšším rate limitom
- skills `api-smoke`, `backend-conventions`, `frontend-conventions`, `local-env` doplnené o auth, `testing` o E2E

### Míľnik A: Základ (2026-10-16)

- AI harness: hierarchia `AGENTS.md`, päť rolí agentov, workflow s worktree a kontrolou `check-scope.sh`, adaptéry pre Claude Code, Codex a Cursor, 10 skills
- monorepo (pnpm 12, Node 24), root ESLint a Prettier, TypeScript 6 strict, husky, lint-staged, commitlint, secretlint
- zdieľaný kontrakt `@locale/shared`: chybové a validačné kódy, schémy emailu, hesla a health
- backend: Express 5 cez `createApp`, validácia ENV, chybový kontrakt, Prisma 7 s modelmi `User` a `Session`, idempotentný seed admina, `GET /api/health` so stavom DB, integračné testy voči `locale_test`
- frontend: Vite+ SPA, Mantine theme podľa Figmy, DM Sans lokálne, Tailwind s CSS layers, i18n (sk, en), TanStack Router a Query, axios inštancia s CSRF hlavičkou, stránka 404
- Docker Compose (db, backend, frontend s healthcheckmi), nginx proxy a SPA fallback, skripty pre vývojový režim aj produkčný stack
