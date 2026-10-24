---
title: 'Changelog'
updated: 2026-10-24
notion_page_id:
---

# Changelog

## Po fáze 1

### Filter upozornení po oprave (2026-10-24)

- frontend: keď sa pri zapnutom filtri upozornení opraví posledné upozornenie, stránka Preklady filter sama zruší, banner zmizne a tabuľka ukáže všetky kľúče (predtým ostal banner s nulou a prázdna tabuľka)

### Zmena prekladu v Histórii (2026-10-24)

- frontend: riadok úpravy prekladu v **Histórii** má ikonu **Zobraziť zmenu**, ktorá otvorí modál **Zmena prekladu** (kto, kedy, kľúč, jazyk, verzia) so starým a novým textom zvýrazneným po slovách: odstránené slová prečiarknuté červenou, pridané zelenou; iba na čítanie, bez obnovenia; tlačidlo **Otvoriť preklad** otvorí kľúč v Prekladoch rovno v modáli Upraviť preklad; premenné a HTML tagy sú v kľúči aj v hodnotách čipy ako v modáli Upraviť preklad
- závislosti: `diff` (jsdiff) 9.0.0, iba v lazy chunku stránky História ([Frontend](./frontend.md#stránka-história))

### Prehľad, sidebar a Jazyky (2026-10-24)

- frontend: Prehľad má kartu **Vyplnené bunky** (podiel vyplnených buniek kľúče × jazyky z poľa `strings`) a kartu **Verzie** (počet verzií, aktuálna verzia, odkaz **Zobraziť verzie**); karta **Jazyky** má odkaz **Zobraziť jazyky**; karty sú v 3 stĺpcoch
- frontend: čísla kariet a percentá jazykov sa napočítavajú od 0 a progress bary sa plnia; pri zapnutom obmedzení pohybu v systéme sa animácie vypnú
- frontend: nové poradie položiek sidebaru v projekte: Prehľad, Preklady, Verzie, História, Jazyky, Členovia, Nastavenia; `/projects/$projectSlug` ďalej otvára Preklady
- frontend: tabuľka na stránke **Jazyky** nemá stĺpce **Preložené** a **Pokrytie** (patria verzii) ani odkazy na Preklady (ikona **Otvoriť preklady** a odkaz v názve jazyka); editor nemá stĺpec akcií

### História zmien (2026-10-24)

- api: `GET /api/projects/:projectId/activity` má číslované stránky (`page`, `pageSize`) namiesto kurzora, filtre `userId`, `category`, `versionId`, `from`, `to` a v odpovedi `total` a `users` (kontrakt `activityListQuerySchema`, `ACTIVITY_TYPE_CATEGORY` v `packages/shared`)
- frontend: nová stránka **História** (`/projects/$projectSlug/history`, v sidebari za Prehľadom, aj pre návštevníka) s tabuľkou všetkých zmien projektu, filtrami Kto, Typ zmeny, Verzia a Obdobie (celé, posledných 7, 30 alebo 90 dní) v URL, prepínačom **Len moje zmeny** a číslovaným stránkovaním
- frontend: **Posledná aktivita** na Prehľade ukazuje posledných 10 udalostí bez **Načítať ďalšie** (karta sa už nenaťahuje) a v hlavičke má odkaz **Zobraziť históriu**
- frontend: nový a upravený kľúč v aktivite a Histórii vedie administrátora na ten kľúč v Prekladoch (editor a návštevník udalosť iba vidia), vytvorenie a úprava verzie na Preklady tej verzie

### Upozornenia vo všetkých jazykoch (2026-10-23)

- frontend: udalosti v **Posledná aktivita** majú na avatare farebnú ikonu kategórie (preklad, import, kľúč, verzia, jazyk, člen, projekt); import, ktorý iba prevzal kľúče predchádzajúcej verzie, už neukazuje prázdne „import CSV:“, ale počet prevzatých a odstránených kľúčov alebo „bez zmien“
- frontend: odkaz úpravy prekladu v **Posledná aktivita** otvorí Preklady vo verzii úpravy a rovno modál **Upraviť preklad** daného kľúča a jazyka (`?editKey=&editLanguage=`, po otvorení zmiznú z URL); veta udalosti má najviac 2 riadky
- frontend: modál **Exportovať preklady** je širší (720 px)
- frontend: v modáli **Upraviť preklad** je posledná úprava v tooltipe ikony za labelom prekladu, **Zrušiť** je v pätičke vľavo a vedľa **Uložiť a ďalší** sa ukladacie tlačidlo volá **Uložiť a zavrieť**
- frontend: disabled primárne tlačidlo nemá ružový tieň a má jemný ružový odtieň namiesto šedej, aby sa líšilo od disabled sekundárneho
- frontend: modály **Upraviť preklad** a **Upraviť projekt** majú tlačidlá v pätičke oddelenej čiarou ako ostatné modály (`footerInBody` v `AppModal`)
- frontend: **Uložiť a ďalší** v modáli Upraviť preklad je disabled, kým sa pole nezmení (ako **Uložiť**), a `Cmd/Ctrl+Enter` bez zmeny už nepreskočí na ďalší preklad
- frontend: hodnota základného jazyka v modáli **Upraviť preklad** je stlmená, upravovaný preklad ostal výrazný
- frontend: ikona v banneroch verzie a upozornení je zvislo na strede prvého riadku (s textom aj tlačidlom), aj keď sa text na mobile zalomí
- frontend: nastavenie projektu **Ochrana dynamických segmentov / Chrániť výrazy** sa volá **Kontrola premenných / Neukladať preklad s nezhodnými premennými** a jeho popis hovorí, čo naozaj robí (odmietne uloženie prekladu s nezhodnými premennými); v aktivite „kontrola premenných“
- frontend: stĺpec Stav je užší (7,75 rem), takže odznak má po stranách rovnaké odsadenie ako bunky prekladov a kľúča
- frontend: plurálová bunka v tabuľke skráti každú formu na 2 riadky, takže riadok s plurálom už nie je príliš vysoký
- frontend: v modáli **Pridať kľúč** je popis namespace pod selectom, takže polia Kľúč a Namespace sú zarovnané
- frontend: nepreložená bunka ukáže pri hoveri tooltip „Nepreložené“; viac dôvodov v tooltipe bunky je pod sebou
- frontend: **Zobraziť upozornenia** v zobrazení Zdroj → cieľ prepne na Všetky jazyky a zruší výber Zobrazené jazyky, lebo varovanie môže byť v hociktorom jazyku

### Zvýraznenie zmien bez filtra (2026-10-23)

- API: `GET …/translations` vracia v položke `diff: { added, changedLanguageIds }` vždy, keď verzia má predchádzajúcu, nielen s `diff=true`; prvá verzia projektu `diff` neposiela
- frontend: bunka s nezhodou premenných má oranžový rámček a varovanie ukáže tooltip pri hoveri na celú bunku, nie iba na ikonu
- frontend: stĺpce jazykov sa dajú rozťahovať iba vo Všetkých jazykoch a najviac na 800 px; v Zdroj → cieľ ťahadlo zaniklo, a tým aj chyba, keď sa stĺpec vo Všetkých jazykoch nedal zúžiť pod šírku nameranú v Zdroj → cieľ
- frontend: Zdroj → cieľ ukazuje pri kľúči čas aj vtedy, keď cieľ ešte nikto nezapísal (najnovšia zmena v ktoromkoľvek jazyku)
- frontend: zobrazenie Zdroj → cieľ má rovnako husté bunky ako Všetky jazyky (padding 6 / 12 px, rámček 4 / 8 px)
- frontend: nepreložená bunka tabuľky je prázdna s červeným rámčekom bez červeného pozadia, text „Bez prekladu“ ostal len pre čítačky
- frontend: v úzkej tabuľke Prekladov (pod 65 rem) ukazuje stĺpec Stav iba farebnú bodku, aby sa zmestil tretí jazyk
- frontend: HTML tagy v hodnotách (`<strong>`, `<a href="…">`, …) sú v tabuľke a v hodnote základného jazyka v modáli neutrálny chip ako v editore, odlíšený od chipu premennej
- frontend: názov kľúča a zdrojový text kompaktného zobrazenia majú stlmenú farbu `--mantine-color-text`, aby vynikli preklady
- frontend: odznak **Nové** a ľavý okraj zmenenej bunky sú v tabuľke Prekladov vždy (okrem prvej verzie), **Zobraziť len zmeny** už len filtruje riadky; zmenená bunka má tooltip „Zmenené oproti predchádzajúcej verzii“

### Zastarané API (2026-10-23)

- frontend: route guardy a loader projektu volajú `queryClient.query` namiesto zastaraných `ensureQueryData` a `fetchQuery` (TanStack Query 5.104; `ensureQueryData` → `query({ ...options, staleTime: 'static' })`, správanie rovnaké); formuláre používajú `SubmitEvent` / `SubmitEventHandler` namiesto zastaraných `FormEvent` / `FormEventHandler` z `@types/react`
- nástroje: ESLint pravidlo `@typescript-eslint/no-deprecated` je zapnuté ako chyba, `pnpm lint` zachytí použitie zastaraného API
- agenti: role `frontend-developer` a `backend-developer` nesmú použiť zastarané API ani pridať zastaranú závislosť (opravia ju pred commitom); `code-reviewer` to kontroluje ako finding `medium` (už predtým zastarané balíky nie sú finding kroku)

### Referencia premenných pri vetných kľúčoch (2026-10-23)

- shared: `placeholderReference(key, baseValue, isBase)` určuje, s čím sa porovnávajú premenné bunky. Vetný kľúč s premennými (nie plurálový) je referenciou pre všetky jazyky vrátane základného; inak hodnota základného jazyka (prípadne názov kľúča, keď je prázdna) a základný jazyk sa nekontroluje
- backend: úprava bunky, Pridať kľúč, náhľad importu, kontrola exportu aj `Translation.placeholderWarning` používajú túto referenciu; základný jazyk, ktorému chýba premenná vetného kľúča, má upozornenie a preklady, ktoré ju majú, už nie. Migrácia `recompute_placeholder_warnings` vynuluje príznak a seed ho pri štarte prepočíta ([API](./api/translations.md#ochrana-premenných))
- backend: import prepočíta upozornenia aj kľúčov, ktoré iba zmenil na plurálové (bez zápisu hodnoty); náhľad importu pri prázdnej bunke základného jazyka porovnáva s hodnotou, ktorá v projekte ostane
- frontend: ⚠ v tabuľke a živá kontrola v modáli **Upraviť preklad** aj pre základný jazyk vetného kľúča; texty „Premenné v preklade sa nezhodujú s kľúčom alebo základným jazykom.“, „Premenná nie je v kľúči ani v základnom jazyku…“ a banner „…ktoré sa líšia od kľúča alebo základného jazyka…“

### Port dev backendu (2026-10-23)

- lokálny vývoj: dev backend počúva na porte **4000** namiesto 3000 (`PORT` v `.env`, predvolená hodnota v `env.ts`) a Vite proxy mieri na `http://127.0.0.1:4000`. Na 3000 až 3003 bežia iné FE projekty a `localhost:3000` sa v Node preložil na IPv6 `::1`, kde počúval Vite iného projektu, takže `/api` nešlo do backendu. V existujúcom `.env` treba zmeniť `PORT=3000` na `PORT=4000`. Docker stack sa nemení ([Lokálny vývoj](./local-development.md))

### Lišta filtrov v Prekladoch (2026-10-22)

- frontend: výber **Verzia** je v lište filtrov tretí, hneď za zoradením; selecty rastú najviac do 16 rem, takže zalomený filter **Zmenené** sa v zobrazení Zdroj → cieľ už neroztiahne cez celý druhý riadok ([Frontend](./frontend.md))

### Preklady zo stránky Jazyky (2026-10-22)

- frontend: v tabuľke na stránke Jazyky otvorí názov jazyka aj ikona **Otvoriť preklady** (aj pre editora) Preklady s týmto jazykom ako cieľom v zobrazení Zdroj → cieľ (`?target=`), vo Všetkých jazykoch zobrazí iba ten jazyk vedľa základného; editor má preto v tabuľke stĺpec akcií ([Frontend](./frontend.md#jazyky-projektu))
- frontend: percento pokrytia na stránke Jazyky zaokrúhľuje `formatShare` ako Prehľad a karty v Prekladoch, predtým nadol (2401 / 2457 ukazovalo 97 % v Jazykoch a 98 % v Prekladoch); takmer celé pokrytie je „> 99 %“

### Lokálny vývoj (2026-10-22)

- backend: `pnpm dev` z interaktívneho terminálu sa už nezasekne na `prisma generate` (v `--parallel` behu dostával SIGTTIN a backend nikdy nepočúval, SPA ukazovala „Niečo sa pokazilo“); dev skript mu dáva stdin z `/dev/null`

### Chýbajúce preklady a jazyk v kartách (2026-10-22)

- API: `GET …/translations` vracia v `stats` aj `untranslatedByLanguage` (počet kľúčov verzie bez hodnoty za každý jazyk projektu) ([API](./api/translations.md))
- frontend: karta Nepreložené ukazuje pri počte kľúčov aj súčet chýbajúcich prekladov „2 % kľúčov · 355 chýbajúcich prekladov“ (vo Všetkých jazykoch za všetky jazyky, v Zdroj → cieľ za cieľový), ktorý klesá s každým vyplneným prekladom; výber Zobrazené jazyky má ✕ na zrušenie výberu a na desktope sa rozťahuje do šírky; v zobrazení Zdroj → cieľ karty Preložené / Nepreložené a banner verzie uvádzajú vlajku a názov cieľového jazyka ([Frontend](./frontend.md))

### Dátumy verzie a import (2026-10-22)

- frontend: kalendár pri dátumoch verzie zvýrazní dnešok a má pod sebou tlačidlo **Dnes**, ktoré vyplní dnešný dátum a prepne kalendár na aktuálny mesiac; tlačidlo **Vytvoriť novú** v dialógu importu má výšku výberu verzie (44 px); v tabuľke verzií sú „Vytvoril …“ a „Import …“ iba v tooltipe ikony (i) pri názve, nie pod ním; názov verzie a nová akcia **Otvoriť preklady** (aj pre editora) otvoria Preklady s touto verziou; karty Preložené a Nepreložené na Prekladoch majú jemné zelené a červené pozadie a vedľa čísla podiel „93 % kľúčov“; **Uložiť** v modáloch Upraviť preklad, Upraviť kľúč, Upraviť verziu a Upraviť e-mail je disabled, kým sa nič nezmení (Nastavenia projektu a Profil to už mali); ikona ⚠ nesúladu premenných sa ukáže aj pri premennej navyše, v bunke je v rohu mimo ellipsis a v modáli Upraviť preklad pri labeli Preklad ([Frontend](./frontend.md#stránka-verzie-projektu))

### Verzie ako kópie prekladov – míľnik F (2026-10-22)

- E2E: `versions.spec.ts` prepísaný na model kópií (prázdna verzia, import s prevzatím predchodcu a odstránením kľúčov, diff v zozname a exporte, mazanie verzie, editor mimo okna), ostatné špecifikácie a helpery vytvárajú verziu a posielajú `versionId`; nová fixture `import-next.csv` ([testovanie](./testing.md)); doménová tabuľka v `AGENTS.md` popisuje verzie ako kópie

### Verzie ako kópie prekladov – míľnik E (2026-10-22)

- frontend: stránka Verzie má stĺpec **Kľúče** („bez importu“ pri prázdnej verzii), čas posledného importu pod názvom a akciu **Zmazať** s potvrdením (`DeleteVersionModal`, aktuálna verzia sa zmazať nedá); Prehľad projektu má výber verzie (predvolene aktuálna), čísla aj denná aktivita sú za zvolenú verziu a udalosti vo feede nesú názov verzie ([Frontend](./frontend.md#stránka-verzie-projektu))

### Verzie ako kópie prekladov – míľnik D (2026-10-22)

- frontend: stránka Preklady má prepínač **Zobraziť len zmeny** (`?diff=true`) s odznakom **Nové** pri pridaných kľúčoch a zvýraznenou zmenenou bunkou, banner verzie hovorí „Oproti v2.44: 4 nové, 1 zmenený, 0 odstránených kľúčov“, verzia bez importu má prázdny stav s tlačidlom Importovať a bez Pridať kľúč; krok kontroly importu ukazuje prevzaté kľúče z predchádzajúcej verzie a varovanie o odstránených; export má checkbox **Len zmeny oproti predchádzajúcej verzii** ([Frontend](./frontend.md#verzie-na-stránke-preklady))

### Verzie ako kópie prekladov – míľnik C (2026-10-22)

- API: `GET …/translations?diff=true` vráti iba kľúče pridané alebo zmenené oproti predchádzajúcej verzii s `diff: { added, changedLanguageIds }`; `GET …/versions/:versionId/diff` dá súhrn (`previousVersion`, `added`, `changed`, `removed`); `DELETE …/versions/:versionId` zmaže verziu aj s kľúčmi (aktuálnu nie, 409 `PROJECT_VERSION_CURRENT`) a zapíše `VERSION_DELETED`; prehľad (`/dashboard`) a denná aktivita počítajú jednu verziu (`versionId`, predvolene aktuálna, inak najnovšia) a udalosti v zozname aktivít nesú `version` ([verzie](./api/project-versions.md), [preklady](./api/translations.md), [prehľad](./api/dashboard.md))
- model: `ActivityEvent.versionId` (migrácia `version_activity`), udalosti kľúčov, buniek, importu a verzie sa viažu na verziu ([databáza](./database.md#activityevent))

### Verzie ako kópie prekladov – míľnik B (2026-10-22)

- API: import kopíruje kľúče najbližšej staršej verzie (so všetkými jazykmi) a definuje množinu kľúčov verzie (kľúče chýbajúce v súbore zmaže); náhľad vracia `keys.copiedFromPrevious`, `previousVersion` a `removed`, výsledok `keysCopied` a `keysRemoved`; `POST …/keys` do verzie bez importu vráti 409 `PROJECT_VERSION_EMPTY`; export má `diffOnly` (iba kľúče pridané alebo zmenené oproti predchádzajúcej verzii) ([import](./api/imports.md#zlúčenie-s-dátami-verzie), [export](./api/exports.md#query), [preklady](./api/translations.md))

### Verzie ako kópie prekladov – míľnik A (2026-10-22)

- model: každá verzia má vlastnú kópiu kľúčov a buniek (`TranslationKey.versionId` povinné, unikátnosť `(versionId, namespace, name)`, `Cascade`; `Translation.versionId` zaniká; `ProjectVersion.importedAt`), migrácia `version_snapshots` existujúce kľúče zmaže, seed vytvorí projekt s verziami v2.44 (uzamknutá) a v2.45 (aktuálna) ([ADR 0007](./decisions/0007-version-snapshots.md), [databáza](./database.md#projectversion))
- API: `GET …/translations`, export a kontrola pred exportom majú `versionId` povinné (400 bez neho, 404 cudzia verzia) a čítajú jednu verziu; `versionScope` zaniká; `PUT …/translations/:languageId` bez `versionId` (bunka patrí verzii kľúča); `POST …/keys`, náhľad importu aj import majú `versionId` povinné; výsledok importu má `version` vždy; verzia má `importedAt` a `keyCount`; editor je mimo okna verzie (aj pred začiatkom) uzamknutý ([verzie](./api/project-versions.md), [preklady](./api/translations.md), [import](./api/imports.md), [export](./api/exports.md))
- API: zoznam projektov a stránka Jazyky počítajú kľúče predvolenej verzie projektu (aktuálna, inak najnovšia)
- frontend: stránka Preklady vždy ukazuje jednu verziu (z URL, inak aktuálnu, inak najnovšiu), bez „celého projektu“ a bez chipu verzie; projekt bez verzií má prázdny stav; import a export idú vždy do zobrazenej verzie (bez „Bez verzie“ a bez „Len zmeny tejto verzie“) ([Frontend](./frontend.md#verzie-na-stránke-preklady))

### Verzie prekladov – vytvorenie a zamknutie zo stránky Preklady (2026-10-22)

- frontend: stránka Preklady sa otvára na práci aktuálnej verzie (filter Verzia je predvolený, `?version=ALL` = celý projekt; karty štatistík a Zrušiť filtre ho nastavia)
- frontend: banner verzie na stránke Preklady povie, koľko kľúčov z práce verzie je ešte nepreložených; filtre prekladov majú ikony a Zoradenie je hneď za vyhľadávaním
- frontend: dátumy verzie vo formulári sú `DateInput` z `@mantine/dates` (nová závislosť s `dayjs`) s kalendárom v štýle aplikácie a lokalizovaným formátom; popisy polí sú pod vstupmi, aby boli obe polia zarovnané ([Frontend](./frontend.md#stránka-verzie-projektu))
- frontend: stránka Preklady má pre `ADMIN` tlačidlo **Vytvoriť verziu** (nová verzia sa hneď zapne vo filtri) a v banneri verzie **Zamknúť** / **Odomknúť**; import predvolí verziu zapnutú vo filtri namiesto aktuálnej ([Frontend](./frontend.md#verzie-na-stránke-preklady))

### Zmena hesla v profile (2026-10-22)

- API: `PUT /api/profile/password` s telom `{ currentPassword, newPassword }` overí aktuálne heslo (400 `PASSWORD_INCORRECT`), uloží nový hash a `passwordChangedAt`, vráti `Profile`; sessions zostávajú ([profil](./api/profile.md#put-apiprofilepassword))
- frontend: tlačidlo **Zmeniť heslo** na stránke Môj profil otvára modál s aktuálnym heslom, novým heslom a jeho potvrdením ([Frontend](./frontend.md#stránka-môj-profil))

### Verzie prekladov – filter, odpočet, import a export (2026-10-22)

- frontend: stránka Preklady má filter **Verzia** (`?version=`), chip verzie pri kľúči, odpočet dní do uzamknutia verzie a tabuľku iba na čítanie pre editora v uzamknutej verzii; úprava bunky a Pridať kľúč posielajú verziu z filtra; import má krok **Verzia** s vytvorením novej verzie z modálu; export so zapnutým filtrom exportuje stav projektu k verzii alebo iba jej zmeny ([Frontend](./frontend.md#verzie-na-stránke-preklady))

### Verzie prekladov – stránka Verzie (2026-10-22)

- frontend: stránka **Verzie** (`/projects/$projectSlug/versions`, položka v sidebari projektu) so zoznamom verzií, stavmi Pripravuje sa / Prebieha / Uzamknutá a pre `ADMIN` modálmi Vytvoriť / Upraviť verziu (natívne dátumové polia) a potvrdením Zamknúť / Odomknúť ([Frontend](./frontend.md#stránka-verzie-projektu)); ikony `Tag`, `Lock`, `LockUnlocked`

### Verzie prekladov – zápis, filter a export (2026-10-22)

- API: import (`versionId`, predvolene `null`), úprava bunky a Pridať kľúč (`versionId`, inak aktuálna verzia podľa dátumu) zapisujú verziu na kľúče a bunky; uzamknutá verzia vráti `EDITOR`-ovi 409 `PROJECT_VERSION_LOCKED` ([import](./api/imports.md#telo-požiadavky), [preklady](./api/translations.md))
- API: `GET …/translations` má filter `versionId` (práca verzie) a `version` v položke; export a kontrola pred exportom majú `versionId` + `versionScope` (`UP_TO` = stav projektu k verzii, `ONLY` = práca verzie) ([export](./api/exports.md#query))

### Verzie prekladov – model a API (2026-10-22)

- databáza: tabuľka `ProjectVersion` (názov, `startsAt`, `endsAt`, `lock`) a nullable `versionId` na `TranslationKey` a `Translation` (migrácia `project_versions`); verzia sa nemaže ([Databáza](./database.md#projectversion), [ADR 0006](./decisions/0006-project-versions.md))
- API: `GET`/`POST …/versions` a `PATCH …/versions/:versionId` (názov, dátumy, ručné zamknutie a odomknutie, iba ADMIN), udalosti `VERSION_CREATED` a `VERSION_UPDATED`, kódy `PROJECT_VERSION_NAME_TAKEN`, `PROJECT_VERSION_NOT_FOUND`, `PROJECT_VERSION_LOCKED` ([API](./api/project-versions.md)). Zápis verzie na kľúče a bunky, filter a export prídu v ďalších míľnikoch plánu [`translation-versions`](./plans/translation-versions.md)

### Banner upozornení na premenné (2026-10-21)

- e2e: `translations.spec.ts` overí banner, filter `?warnings=true` aj jeho zrušenie na projekte z `import-sample.csv` ([Testovanie](./testing.md#e2e-testy-playwright))
- frontend: stránka Preklady ukáže žltý banner s počtom kľúčov, ktorých premenné sa líšia od základného jazyka, a tlačidlom **Zobraziť upozornenia** (filter `?warnings=true`), resp. **Zrušiť filter upozornení** ([Frontend](./frontend.md#stránka-preklady))

### Upozornenia na premenné – filter a počet v API (2026-10-21)

- API: `GET …/translations` má filter `warnings=true` (iba kľúče s bunkou s upozornením) a `stats.warnings` (počet takých kľúčov v projekte, bez filtrov) ([API](./api/translations.md#get-apiprojectsprojectidtranslations))

### Upozornenia na premenné – uložený príznak (2026-10-21)

- databáza: `Translation.placeholderWarning` (migrácia `translation_placeholder_warning`) drží, či sa premenné bunky líšia od základného jazyka; prepočítava sa pri úprave, Pridať kľúč, premenovaní, importe a zmene základného jazyka, staré riadky dopočíta seed pri štarte ([Databáza](./database.md#translation)). Banner a filter na stránke Preklady prídu v ďalších míľnikoch plánu [`translation-warnings`](./plans/translation-warnings.md)

### Základný jazyk vetného kľúča, popis kľúča ako ikona (2026-10-21)

- API: pri `PUT …/translations/:languageId` a `POST …/keys` sa aj hodnota základného jazyka porovná s premennými v názve kľúča, keď ich názov obsahuje (vetný kľúč `Cena ({{symbol}})`); kľúče bez premenných v názve sa v základnom jazyku nekontrolujú ([API](./api/translations.md#ochrana-premenných))
- frontend: popis kľúča sa v tabuľke prekladov neukazuje ako text, ale ako ikona (i) s tooltipom; v modáli Pridať kľúč má základný jazyk badge **Základný** vedľa názvu namiesto popisu pod labelom ([Frontend](./frontend.md#stránka-preklady))

### Pridať kľúč v dvoch stĺpcoch (2026-10-21)

- frontend: modál Pridať kľúč má od piatich jazykov šírku 720 px a nad telefónom dva stĺpce (Kľúč vedľa Namespace, jazyky po dvoch) ([Frontend](./frontend.md#modál-pridať-kľúč))

### Ochrana premenných počíta výskyty, vlajky v exporte (2026-10-21)

- shared + API: `comparePlaceholders` porovnáva aj počet výskytov každej premennej (pri pluráli najvyšší počet vo forme), takže preklad s premennou navyše oproti základnému jazyku, napr. `({{count}}) … ({{count}})`, vráti 400 `PLACEHOLDER_MISMATCH` s `extra`; rovnako sa správa upozornenie pri importe a kontrola pred exportom ([API](./api/translations.md#ochrana-premenných))
- frontend: modál Exportovať preklady má pri každom jazyku vlajku ([Frontend](./frontend.md#modál-exportovať-preklady))

### Oprava: Zobraziť členov pre Návštevníka (2026-10-21)

- frontend: karta Členovia na Prehľade nemá pre Návštevníka odkaz **Zobraziť členov** (stránka Členovia je preň 403) ([Frontend](./frontend.md#stránka-prehľad-projektu))

### Rola Návštevník – E2E a dokumentácia (2026-10-21)

- e2e: `visitor.spec.ts` (sidebar, 403 stránky, read-only Preklady s axe skenom, export, 403 z API, zoznam projektov) a `createVisitor` v `support/users.ts`; prehľad rolí v [overview](./overview.md) ([Testovanie](./testing.md#e2e-testy-playwright))

### Rola Návštevník – obmedzenia v aplikácii (2026-10-21)

- frontend: Návštevník má v projekte iba Preklady a Prehľad (sidebar, guard 403 na Nastavenia, Jazyky a Členovia), tabuľka prekladov je iba na čítanie (bunky sú text, modál Upraviť preklad sa neotvára), ostáva mu filtrovanie, zobrazenie a **Exportovať**; na Prehľade nemá Spravovať jazyky, v zozname projektov nemá Nastavenia ani Opustiť projekt ([Frontend](./frontend.md#guardy))

### Rola Návštevník – výber roly v aplikácii (2026-10-21)

- frontend: modál Vytvoriť používateľa ponúka aj rolu **Návštevník** s popisom; select roly v detaile používateľa a na profile ju majú z enumu, `RoleBadge` ju ukáže tlmene ako Editora ([Frontend](./frontend.md#správa-používateľov))

### Rola Návštevník – obmedzenia API (2026-10-21)

- API: `PUT /api/projects/:projectId/keys/:keyId/translations/:languageId` a `DELETE /api/projects/:projectId/membership` vrátia členovi s rolou `VISITOR` 403 `FORBIDDEN`; zoznam prekladov, Prehľad a export mu ostávajú ([API](./api/translations.md#put-apiprojectsprojectidkeyskeyidtranslationslanguageid), [projekty](./api/projects.md#delete-apiprojectsprojectidmembership))

### Rola Návštevník – kontrakt a databáza (2026-10-21)

- shared + databáza: nová globálna rola `VISITOR` v enume `ROLE` (migrácia `visitor_role`); `POST /api/admin/users`, `PATCH /api/admin/users/:id` a `PATCH /api/profile` ju prijmú, posledný `ADMIN` sa ňou nemôže stať (409 `LAST_ADMIN`) ([API](./api/admin-users.md), [Databáza](./database.md)). Obmedzenia pre rolu (iba Preklady a Prehľad, bez úprav) pribudnú v ďalších míľnikoch plánu [`visitor-role`](./plans/visitor-role.md)

### Upozornenia na premenné pred exportom (2026-10-21)

- API: `GET /api/projects/:projectId/export/check` vráti hodnoty vybraných jazykov, ktorých premenné sa líšia od základného jazyka (`{ warnings, total }`, max. 50) ([API](./api/exports.md#kontrola-pred-exportom-exportcheck))
- frontend: modál Exportovať ukáže tieto nezhody ako žlté upozornenie so zoznamom kľúčov a jazykov; export neblokuje ([Frontend](./frontend.md#modál-exportovať-preklady))

### Varovanie pri premennej, ktorú základný jazyk nemá (2026-10-21)

- frontend: chip premennej, ktorá nie je v základnom jazyku (preklep ako `{{ perecentage }}`), je v tabuľke aj v editore modálu žltý s tooltipom „Premenná nie je v základnom jazyku – skontrolujte preklep.“; premenné základného jazyka, ktoré v preklade chýbajú, ukáže žltá ikona za textom ([Frontend](./frontend.md#stránka-preklady))
- shared: `placeholders` a `comparePlaceholders` sa presunuli z `backend/src/lib/placeholders.ts` do `packages/shared/src/placeholders.ts`, aby FE porovnával rovnako ako API

### Ručné pridanie kľúča (2026-10-21)

- API: `POST /api/projects/:projectId/keys` iba pre `ADMIN` pridá kľúč do existujúceho namespace projektu s voliteľnými hodnotami jazykov; neexistujúci namespace → 400 `VALIDATION_ERROR`, obsadený názov → 409 `TRANSLATION_KEY_TAKEN`, iné premenné ako základný jazyk → 400 `PLACEHOLDER_MISMATCH` s `languageId` ([API](./api/translations.md#post-apiprojectsprojectidkeys))
- databáza: nová hodnota `KEY_CREATED` v enume `ACTIVITY_TYPE` (migrácia `activity_key_created`), Prehľad ju ukáže ako „nový kľúč …“ ([Databáza](./database.md))
- frontend: tlačidlo **Pridať kľúč** na stránke Preklady (iba `ADMIN`, iba ak má projekt kľúče) otvorí modál s kľúčom, namespace a poľom pre každý jazyk; po uložení stránka vyhľadá nový kľúč ([Frontend](./frontend.md#modál-pridať-kľúč))

### Ovládanie zobrazenia prekladov oddelené od filtrov (2026-10-21)

- frontend: zobrazenie, rozloženie, jazyky a **Len preklady** sú v samostatnom riadku nad kartou tabuľky (`TranslationsViewControls`) a odrolujú sa; v sticky hlavičke karty ostali iba filtre v jednom zalamovanom riadku ([Frontend](./frontend.md))

### Posledná aktivita otvorí upravený preklad (2026-10-21)

- frontend: šípka pri úprave prekladu na Prehľade otvorí Preklady s vyhľadávaním názvu kľúča a jeho namespace (`?search=…&namespace=…`) namiesto filtra Editor, takže ukáže práve ten kľúč; import ďalej filtruje zmeny používateľa ([Frontend](./frontend.md#stránka-prehľad-projektu))

### Projekty, jazyky a nastavenia projektu mení iba ADMIN (2026-10-21)

- API: `PATCH /api/projects/:projectId/settings` iba pre `ADMIN`, člen `EDITOR` dostane 403 `FORBIDDEN` ([API](./api/projects.md#patch-apiprojectsprojectidsettings))
- frontend: editor vidí v Nastaveniach projektu všetky polia, prepínač aj **Uložiť zmeny** disabled, aktívne má iba **Opustiť projekt**; bez jazykov nevidí odkaz **Pridať jazyk do projektu**
- API: `POST /api/projects/:projectId/languages` iba pre `ADMIN`, člen `EDITOR` dostane 403 `FORBIDDEN`, nečlen ďalej 404 ([API](./api/project-languages.md#post-apiprojectsprojectidlanguages))
- API: `DELETE /api/projects/:projectId/languages/:languageId` iba pre `ADMIN`, člen `EDITOR` dostane 403 `FORBIDDEN` ([API](./api/project-languages.md#delete-apiprojectsprojectidlanguageslanguageid))
- API: `PUT /api/projects/:projectId/languages/order` iba pre `ADMIN`, člen `EDITOR` dostane 403 `FORBIDDEN` ([API](./api/project-languages.md#put-apiprojectsprojectidlanguagesorder))
- frontend: tlačidlo **Pridať jazyk** na stránke Jazyky (aj v prázdnom stave) a ikonu koša **Odobrať** vidí iba `ADMIN`; editor nemá v tabuľke jazykov stĺpec akcií ani úchyty na presun a popis stránky mu presúvanie nespomína
- API: `POST /api/projects` iba pre `ADMIN`, `EDITOR` dostane 403 `FORBIDDEN` ([API](./api/projects.md#post-apiprojects))
- frontend: tlačidlo **Nový projekt** na úvodnej stránke vidí iba `ADMIN`; prázdny zoznam editora hovorí, že ho do projektu pridá administrátor ([Frontend](./frontend.md))
- e2e: projekty „člena“ vytvára ADMIN cez `createProjectOf` (pridá člena a sám odíde)

### Nápoveda k základnému jazyku a návrat do projektu zo správy (2026-10-21)

- frontend: odznak **Základný** v tabuľke prekladov a na stránke Jazyky má tooltip, čo základný jazyk znamená; rovnaký text je pod poľom **Základný jazyk** v nastaveniach projektu ([Frontend](./frontend.md))
- frontend: stránky správy otvorené z projektu majú v sidebare **Späť na projekt** namiesto **Všetky projekty** (`?from=<slug>`) ([Frontend](./frontend.md#layout-sidebar-a-horná-lišta))
- frontend: loader v tlačidlách (napr. **Uložiť** a **Uložiť a ďalší**) je v strede aj pri zapnutom obmedzení animácií v systéme; Mantine ho centruje iba inline štýlom prechodu, ktorý `respectReducedMotion` vynechá, preto ho centruje aj trieda `loader` v `styles/components/Button.module.css`
- frontend: text odznaku **ZÁKLADNÝ** na stránke Jazyky je zvislo v strede cez `text-box: trim-both cap alphabetic` namiesto horného paddingu 1 px ([Frontend](./frontend.md#stránka-jazyky-projektu))

### Kompaktný sidebar (2026-10-21)

- frontend: tlačidlo **Zbaliť menu** dole v sidebare (od 62 em) ho zúži na 80 px s logom, avatarom projektu a ikonami s tooltipmi; voľba sa pamätá v prehliadači ([Frontend](./frontend.md#layout-sidebar-a-horná-lišta))

### Filter Editor na stránke Preklady (2026-10-20)

- API: `editors` v `GET …/translations` obsahuje každého člena projektu (aj bez úprav) a ďalších, kto uložil preklad, zoradených podľa počtu prekladov, ktoré naposledy upravili ([API](./api/translations.md))
- frontend: filter **Upravil** sa volá **Editor**, placeholder **Všetci editori** ([Frontend](./frontend.md))

### Zdieľaný Postgres medzi checkoutmi (2026-10-20)

- skripty: `pnpm db:up`, `pnpm stack:up` a `pnpm test:e2e` spúšťajú `db` s `--no-recreate`, takže beh z git worktree už znova nevytvorí kontajner `locale-admin-db-1`, ktorý používa iný checkout (padali integračné testy na `57P03`); `stack:up` potom spustí `backend` a `frontend` s `--no-deps` ([Lokálny vývoj](./local-development.md#dva-režimy))

### Prehľad projektu – frontend (2026-10-20)

- frontend: stránka **Prehľad** `/projects/$projectSlug/dashboard` podľa Figmy `3:475` bez Importovať a Exportovať, s tlačidlom **Otvoriť preklady**: karty Kľúče, Preložené, Jazyky a Členovia, Stav jazykov, Posledná aktivita (po dňoch, Načítať ďalšie) a Denná aktivita (graf 7 / 30 / 90 dní, najaktívnejší členovia). Odkazy otvárajú Preklady s filtrom (nepreložené, jazyk, zmeny používateľa) ([Frontend](./frontend.md#stránka-prehľad-projektu))
- frontend: **Prehľad** je druhá položka sidebaru v projekte (ikona `LayoutGrid` z Figmy); `/projects/$projectSlug` ďalej otvára Preklady
- frontend: karta `StatCard` vytiahnutá z `TranslationStats` do `components/StatCard`, Preklady vyzerajú rovnako
- frontend: mutácie prekladov, kľúčov, jazykov, členov a nastavení obnovia aj prehľad a aktivitu projektu ([Frontend](./frontend.md#prehľad-a-aktivita))
- závislosti: `@mantine/charts` 9.6.3 a `recharts` 3.10.1, iba v lazy chunku stránky Prehľad ([Frontend](./frontend.md#lazy-routy-code-splitting))

### Prehľad projektu – čítacie endpointy (2026-10-20)

- API: `GET /api/projects/:projectId/dashboard` (kľúče, nové kľúče za 30 dní, preložené kľúče, vyplnené bunky, slová základného jazyka), `GET …/activity` (feed udalostí s kurzorom) a `GET …/activity/daily` (denné súčty `count` za 7 / 30 / 90 dní v zóne používateľa, top 5 členov), pre každého člena a `ADMIN` ([API](./api/dashboard.md))
- shared: `dashboardResponseSchema` v `packages/shared/src/dashboard.ts`; `activityEventSchema`, `activityListQuerySchema`, `activityListResponseSchema`, `ACTIVITY_RANGES`, `activityDailyQuerySchema` a `activityDailyResponseSchema` v `packages/shared/src/activity.ts`

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
