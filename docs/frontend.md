---
title: 'Frontend'
updated: 2026-10-16
notion_page_id:
---

# Frontend

React SPA na Vite+ (`vp dev`, `vp build`, `vp test`) s Mantine 9, Tailwind 4, TanStack Router a Query, axios a react-i18next.

## Skripty

Spúšťajú sa z rootu cez `pnpm --filter frontend <skript>`.

| Skript           | Čo robí                                                                          |
| ---------------- | -------------------------------------------------------------------------------- |
| `dev`            | dev server na `http://localhost:5173`, `/api` proxuje na `localhost:3000`        |
| `build`          | produkčný build do `frontend/dist`                                               |
| `preview`        | servíruje `dist` na `http://localhost:4173` (s rovnakou `/api` proxy)            |
| `test`           | unit testy (Vitest cez Vite+, prostredie jsdom), súbory `src/**/*.test.{ts,tsx}` |
| `typecheck`      | `tsc --noEmit`                                                                   |
| `generate-icons` | vygeneruje React komponenty ikon zo SVG (viď Ikony)                              |

## Štruktúra `src/`

| Priečinok     | Obsah                                                                                                                                                                                  |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `atoms/`      | malé obaly nad Mantine (`ButtonLink`)                                                                                                                                                  |
| `components/` | zložené komponenty (`AppLayout`, `TopBar`, `UserMenu`, `LanguageSwitcher`, `Brand`, `CenteredLayout`, `PageIntro`, `RouteError`, `UsersTable`, `CreateUserModal`, `Icons/`)            |
| `pages/`      | obrazovky rout (`HomePage`, `LoginPage`, `UsersPage`, `ForbiddenPage`, `NotFoundPage`, `ErrorPage`)                                                                                    |
| `routes/`     | strom rout, guardy a router (`createAppRouter`)                                                                                                                                        |
| `api/`        | axios inštancia `http`, `queryClient`, `QUERY_KEYS`, auth hooky (`api/auth/`), hooky správy používateľov (`api/adminUsers/`), 401 interceptor, `getApiErrorCode`, `getApiErrorDetails` |
| `lib/`        | `constants.ts`, `enum.ts`, nastavenie i18n, `ForbiddenError`, `formatDate`                                                                                                             |
| `locales/`    | preklady `sk.json`, `en.json`                                                                                                                                                          |
| `styles/`     | Mantine theme, globálne CSS s poradím vrstiev, prekrytia Mantine komponentov                                                                                                           |
| `assets/`     | `icons/` (zdrojové SVG z Figmy)                                                                                                                                                        |
| `types/`      | typy iba pre FE (typované i18n kľúče)                                                                                                                                                  |
| `test/`       | `setup.ts`, `renderApp` a `mockApi` pre unit testy                                                                                                                                     |

Priečinok komponentu obsahuje `Component.tsx`, `types.ts` (props) a voliteľne `Component.module.css`. Komponenty sa exportujú ako default a importujú plnou cestou (`@/components/Brand/Brand`). Barrel súbor je iba `components/Icons/index.ts`.

## Routing

TanStack Router s routami v kóde (ADR 0002), jeden súbor na routu v `routes/`. Root route má kontext s `queryClient`.

| Cesta          | Route                                  | Stránka                                         | Prístup                                  |
| -------------- | -------------------------------------- | ----------------------------------------------- | ---------------------------------------- |
| `/login`       | `loginRoute`                           | `LoginPage`                                     | iba neprihlásený (prihlásený ide na `/`) |
| `/`            | `indexRoute` pod `_authenticated`      | `HomePage` (vo Fáze 1 prázdna)                  | prihlásený                               |
| `/admin/users` | `adminUsersRoute` pod `_authenticated` | `UsersPage` (zoznam a vytvorenie používateľa)   | `ADMIN`, ostatní vidia `ForbiddenPage`   |
| neexistujúca   | root                                   | `NotFoundPage` (`notFoundComponent` root route) | všetci                                   |

Chyba v `beforeLoad` alebo v komponente routy bez vlastného `errorComponent` zobrazí `ErrorPage` (`defaultErrorComponent` routera).

### Lazy routy (code splitting)

Komponenty stránok `/login` a `/admin/users` sa načítajú až pri prvej návšteve routy. Route súbor (`loginRoute.ts`, `adminUsersRoute.ts`) drží iba kritickú časť (`path`, `beforeLoad` guard, pri `/admin/users` aj `errorComponent`, aby sa 403 zobrazila bez čakania na chunk stránky) a cez `.lazy(() => import('@/routes/<route>.lazy').then((module) => module.Route))` pripojí súbor `<route>.lazy.ts`, ktorý obsahuje `createLazyRoute('<route id>')({ component })`. Route id je cesta vrátane pathless rodiča (`/_authenticated/admin/users`), typecheck preklep v id zachytí. `HomePage` (prázdna) a stránky 404, 403 a chybová stránka ostávajú v hlavnom chunku.

Výsledok `pnpm --filter frontend build` (2026-10-16): hlavný chunk `index` 498 kB (gzip 160 kB), zdieľaný chunk knižníc 231 kB (gzip 73 kB, načíta sa hneď cez `modulepreload`), lazy chunky: stránka Používatelia 38 kB, formuláre (React Hook Form, resolver) 36 kB, prihlásenie 4 kB. Vite už nevypíše varovanie o chunku nad 500 kB, ale hlavný chunk je tesne pod hranicou a JS načítaný pri štarte je spolu asi 730 kB (pred rozdelením 763 kB). Väčšinu tvoria knižnice (React, Mantine, TanStack, zod), ďalšie zmenšenie by vyžadovalo rozdeliť ich, nie stránky.

### Guardy

- `_authenticated` je pathless layout route (bez segmentu v URL) s komponentom `AppLayout`. Jej `beforeLoad` zavolá `queryClient.ensureQueryData(meQueryOptions)`. Pri 401 presmeruje na `/login` (bez `?redirect=`), iné chyby (5xx, nedostupný backend) pustí ďalej a zobrazí sa `ErrorPage`. Načítaného používateľa vráti do kontextu ako `context.user` pre podriadené routy.
- `/login`: `beforeLoad` skúsi načítať `me`. Ak sa podarí, presmeruje na `/`. Akákoľvek chyba (401, nedostupný backend) znamená, že sa zobrazí formulár.
- `/admin/users`: `beforeLoad` pre rolu inú ako `ADMIN` vyhodí `ForbiddenError`. `errorComponent` (`RouteError`) pre túto chybu zobrazí `ForbiddenPage` vnútri layoutu a URL ostáva `/admin/users`. Iné chyby zobrazí `ErrorPage` vnútri layoutu.
- Po prihlásení ide `ADMIN` aj `EDITOR` na `/`.

Produkčný server (nginx) musí pre neznáme cesty vrátiť `index.html` (SPA fallback), inak refresh na hlbokej route skončí chybou servera.

## API

- Jediná axios inštancia `api/http.ts`: `baseURL: '/api'`, `withCredentials: true`.
- Interceptor posiela pri každej požiadavke `X-Requested-With: XMLHttpRequest`. Mutácie (`POST`, `PUT`, `PATCH`, `DELETE`) bez tela pošlú `{}`, aby odišla hlavička `Content-Type: application/json` (ochrana proti CSRF na BE).
- Query kľúče sú iba v `QUERY_KEYS` (`api/queryKeys.ts`).
- `getApiErrorCode(error)` vráti `ERROR_CODE` z odpovede podľa `errorResponseSchema` z `@locale/shared`, inak `UNKNOWN`. Text chyby sa zobrazuje iba cez preklad `errors.<CODE>`, nikdy z `message`. `getApiErrorDetails(error)` vráti `details` z `VALIDATION_ERROR` (inak prázdne pole).
- `queryClient` neopakuje dotazy, ktoré skončili 401 (ostatné chyby najviac 3-krát). Výnimkou je `me` (`retry: false`): guardy naň čakajú pred zobrazením stránky a opakovanie s backoffom by pri 5xx alebo výpadku siete blokovalo stránku asi 7 s.

### Prihlásenie a session

| Hook / funkcia                   | Čo robí                                                                                                                                                                     |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `meQueryOptions`, `useMeQuery`   | `GET /api/auth/me`, kľúč `QUERY_KEYS.AUTH.ME()`, `staleTime: Infinity`, `retry: false` (načítajú ho guardy, drží sa do odhlásenia alebo 401)                                |
| `useLoginMutation`               | `POST /api/auth/login`, odpoveď (`AuthUser`) uloží do `me` a naviguje na `/`                                                                                                |
| `useLogoutMutation`              | `POST /api/auth/logout` bez tela, potom `queryClient.clear()` a navigácia na `/login`                                                                                       |
| `installUnauthorizedInterceptor` | response interceptor (zapína sa v `main.tsx`): pri 401 zavolá `queryClient.clear()` (ako odhlásenie, dáta predošlého používateľa neostanú v cache) a router ide na `/login` |

Interceptor ignoruje `/auth/login` (zlé heslo je chyba formulára) a `/auth/me` (401 z neho riešia guardy samy, inak by sa navigovalo dvakrát). Session cookie (`locale_session`, httpOnly) FE nečíta, posiela ju prehliadač.

### Správa používateľov

| Hook                                           | Čo robí                                                                                                                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `adminUsersQueryOptions`, `useAdminUsersQuery` | `GET /api/admin/users` (`AdminUserListResponse`), kľúč `QUERY_KEYS.ADMIN.USERS()`, globálny `retry` (3 pokusy, nie pri 401)                                        |
| `useCreateUserMutation`                        | `POST /api/admin/users` (`CreateUserRequest` → `AdminUser`). Po úspechu `invalidateQueries(QUERY_KEYS.ADMIN.USERS())` a čaká na nové načítanie, kým mutácia skončí |

## Layout a horná lišta

Prihlásené stránky majú `AppLayout`: horná lišta `TopBar` a pod ňou `<main>` s obsahom routy. Sidebar, drobčeky a ikona `?` vo Fáze 1 nie sú.

Lišta je nový dizajn zložený z prvkov Figmy (node `28:2`): výška 64 px, biele pozadie s 90 % krytím a `backdrop-filter: blur(8px)`, spodný okraj `slate.2` s 80 % krytím, vodorovný padding 32 px, `position: sticky`.

- vľavo `Brand` (logo „Locale / WORKSPACE“)
- vpravo:
    - `LanguageSwitcher`: Mantine `SegmentedControl` SK / EN. Volá `i18n.changeLanguage`, jazyk sa zmení bez reloadu a uloží do `localStorage['locale']`. Viditeľný text je skratka (pre čítačky skrytá cez `aria-hidden`), prístupné meno je názov jazyka v danom jazyku (`VisuallyHidden` s `lang`): rádio **Slovenčina** a **English** v oboch jazykoch UI (kľúče `topBar.languages.<jazyk>.label` a `.name`).
    - zvonček notifikácií: iba statická ikona 18 px v boxe 38 × 38 px, farba `slate.4`, bez akcie a bez ružovej bodky (zatiaľ nie sú notifikácie)
    - `UserMenu`: Mantine `Menu`. Tlačidlo je avatar 32 px (kruh `slate.9`, iniciály 10 px / 700 biele cez `getInitials` zo `@locale/shared`). V menu je email, položka **Používatelia** (iba `ADMIN`, odkaz na `/admin/users`) a **Odhlásiť**. Chyba pri odhlásení sa ukáže ako notifikácia `errors.<CODE>`.

## Prihlasovacia stránka

Podľa Figmy `5:2861`: `CenteredLayout`, `PageIntro` (Prihlásenie / Vitajte späť / popis), polia E-mail a Heslo, tlačidlo **Prihlásiť sa** so šípkou.

- React Hook Form + `zodResolver(loginRequestSchema)` zo `@locale/shared`. Chybové hlášky zodu sa cez `toValidationCode` prekladajú na `validation.<CODE>` (s `{{min}}` / `{{max}}`).
- Odpoveď `VALIDATION_ERROR` s `details` sa priradí k poliam (`setError`). Ostatné chyby sa zobrazia nad tlačidlom (Mantine `Alert`) ako `errors.<CODE>`. Pri 429 sa zobrazí `loginPage.form.rateLimited` so sekundami z hlavičky `Retry-After`, ak hlavička chýba, tak `errors.RATE_LIMITED`.
- Počas odosielania je tlačidlo v stave `loading` (zároveň `disabled`), formulár sa nedá odoslať dvakrát.
- Heslo je obyčajný `TextInput type="password"` bez prepínača viditeľnosti (Figma ho nemá).

## Stránka Používatelia

Podľa Figmy `28:2` bez sidebaru a drobčekov, vnútri `AppLayout` na route `/admin/users` (iba `ADMIN`). Obsah má šírku najviac 1200 px a padding 32 px.

- Hlavička: `PageIntro` s `titleSize="h2"` (malý ružový nadpis „Správa“, H1 „Používatelia“ vo veľkosti 28 px, popis) a vpravo dole primárne tlačidlo **Vytvoriť používateľa** s ikonou `Plus`, ktoré otvorí modál.
- `UsersTable`: Mantine `Table` v karte (biela, okraj `slate.2`, radius `xl`). Hlavička tabuľky na pozadí `slate.0`, texty 10 px / 700 veľkými písmenami `slate.4`. Stĺpce **E-mail** (avatar 32 px s iniciálami z emailu cez `getInitials({ email, firstName: null, lastName: null })`, pozadie `slate.1`, text `slate.6`) a **Vytvorený** (šírka 180 px, dátum cez `formatDate`). Riadky oddeľuje okraj `slate.1`. Poradie je z API (najnovší hore).
- Stavy, ktoré nie sú vo Figme: načítavanie (3 riadky Mantine `Skeleton`, tabuľka má `aria-busy`), prázdny zoznam (text v tabuľke) a chyba (text „Zoznam používateľov sa nepodarilo načítať.“, preklad `errors.<CODE>` a tlačidlo **Skúsiť znova**, ktoré zavolá `refetch`).

### Formátovanie dátumu

`lib/formatDate.ts`: `formatDate(isoDate, language)` cez `Intl.DateTimeFormat` s číselným dňom, mesiacom a rokom, bez dátumovej knižnice. Jazyk UI `sk` → `sk-SK` (`12. 10. 2026`, `3. 10. 2026`), `en` → `en-GB` (`12/10/2026`, `03/10/2026`). Neznámy jazyk použije `sk`. Tabuľka berie `i18n.language`, takže zmena jazyka preformátuje dátumy bez reloadu.

### Modál Nový používateľ

`CreateUserModal` podľa Figmy `28:191`, zložený z `Modal.Root` a podkomponentov (nadpis a popis v hlavičke, vlastná ikona `Close`):

- šírka 560 px, radius `xl`, okraj `slate.2`, tieň `shadows.modal`, overlay `theme.black` s 25 % krytím a rozmazaním 2 px
- hlavička: nadpis „Nový používateľ“ 18 / 28 / 700 `slate.9`, popis 14 px, zatváracie tlačidlo 34 px s ikonou `slate.4`, spodný okraj `slate.1`
- polia **E-mail** (placeholder `meno@firma.sk`) a **Heslo** (`TextInput type="password"`, placeholder `Min. {{min}} znakov` s `PASSWORD_MIN_LENGTH`; Figma má „Min. 6“, platí konštanta)
- päta s pozadím `slate.0` (60 %): **Zrušiť** (`variant="default"`) a **Vytvoriť používateľa**

Správanie:

- React Hook Form + `zodResolver(createUserRequestSchema)` zo `@locale/shared`, chyby zodu cez `toValidationCode` → `validation.<CODE>` (s `{{min}}` / `{{max}}`). Odoslaný email je normalizovaný (trim, malé písmená).
- `400 VALIDATION_ERROR` s `details` → `setError` pri poliach. `409 EMAIL_TAKEN` → `errors.EMAIL_TAKEN` pri poli E-mail. Iné chyby → červená Mantine notifikácia `errors.<CODE>`, modál ostáva otvorený.
- Počas odosielania je tlačidlo v stave `loading` (aj `disabled`) a `onSubmit` počas bežiacej mutácie nič neurobí, formulár sa nedá odoslať dvakrát.
- Po úspechu: invalidácia zoznamu, zelená notifikácia „Používateľ {{email}} bol vytvorený.“, reset formulára a zatvorenie modálu. **Zrušiť**, krížik, `Esc` aj klik mimo modálu formulár tiež resetujú.

## Stránka 403

`ForbiddenPage` (nie je vo Figme) má rovnaký obsah ako 404: malý ružový nadpis „Chyba 403“, H1 „Prístup zamietnutý“, text a tlačidlo **Späť na úvod** na `/`. Zobrazuje sa vnútri `AppLayout` (logo je už v hornej lište), preto nemá vlastné logo ani pätičku, obsah je na stred so šírkou 380 px.

## Chybová stránka

`ErrorPage` (nie je vo Figme) má rovnakú štruktúru ako 404 a 403: malý ružový nadpis „Chyba“, H1 „Niečo sa pokazilo“ a ako popis preklad `errors.<CODE>` z `getApiErrorCode` (pri odpovedi mimo kontraktu, napr. nedostupný backend, `errors.UNKNOWN`). Správa z BE ani text chyby axiosu sa nezobrazujú. Pod textom je primárne tlačidlo **Skúsiť znova** (`router.invalidate()`, znova spustí `beforeLoad` a loadery) a sekundárne **Späť na úvod** na `/`.

- Ako `defaultErrorComponent` routera sa zobrazí v `CenteredLayout` (logo a pätička), lebo chyba `_authenticated` sa renderuje mimo `AppLayout`.
- V `RouteError` (chyby iné ako `ForbiddenError` na `/admin/users`) sa zobrazí s `inAppLayout`, bez vlastného loga a pätičky ako 403.

## i18n

- react-i18next, jazyky `sk` (predvolený aj záložný) a `en`, kľúče v objektovej štruktúre (`notFoundPage.title`).
- Zvolený jazyk sa číta z `localStorage` (kľúč `locale`). Ak `localStorage` nie je dostupný alebo hodnota nie je platná, použije sa `sk`. Pri zmene jazyka sa hodnota uloží a aktualizuje sa `<html lang>`.
- Chyby API: `errors.<ERROR_CODE>` a `errors.UNKNOWN`. Validácia: `validation.<VALIDATION_CODE>`, pri `TOO_SHORT` a `TOO_LONG` s parametrami `{{min}}` a `{{max}}`.
- Unit test `lib/i18n.test.ts` overí, že každý `ERROR_CODE` a `VALIDATION_CODE` z `@locale/shared` má preklad v `sk` aj `en`, že `sk.json` a `en.json` majú rovnakú sadu kľúčov (chyba vypíše chýbajúce kľúče pre každý jazyk) a že žiadna hodnota nie je prázdny reťazec.
- Unit test `lib/i18nStorage.test.ts` načíta `lib/i18n` vždy nanovo (`vi.resetModules`) a overí, že uložený `en` sa použije, neplatná hodnota a výnimka z `getItem` vrátia `sk` a výnimka zo `setItem` nezhodí zmenu jazyka.
- Kľúče sú typované podľa `sk.json` (`types/i18next.d.ts`), preklep v kľúči zachytí `typecheck`. Kľúč chýbajúci v `en.json` typecheck nezachytí (spadol by na `sk`), preto ho stráži test vyššie.

## Štýly

- Poradie vrstiev v `styles/global.css`: `theme, base, mantine, components, utilities`. Tailwind preflight (`base`) je pod Mantine, takže nerozbije jeho komponenty. Tailwind utility sú nad Mantine.
- Mantine má prednosť: theme a prekrytia komponentov (`styles/mantineTheme.ts`), potom CSS moduly, Tailwind iba na layout a spacing.
- Font DM Sans sa hostuje lokálne z balíka `@fontsource-variable/dm-sans`. Nastavuje sa v Mantine theme (`fontFamily`, `headings.fontFamily`) aj v Tailwind `--font-sans`.
- Aplikácia je iba vo svetlej téme.

## Mapovanie Figma → theme

Figma súbor nemá premenné. Hodnoty sú zo štýlov login screenu (node `5:2861`), stránky Používatelia (`28:2`) a modálu (`28:191`) cez `get_design_context`.

### Farby

Šedé sú Tailwind v4 `slate`. V Mantine je to farba `slate`, index 0–9 = `slate-50` až `slate-900`. `slate-950` je `theme.black`.

| Figma            | Kde                                | Theme                                           |
| ---------------- | ---------------------------------- | ----------------------------------------------- |
| `#F7F8FB`        | pozadie stránky                    | `--mantine-color-body`                          |
| `#020618`        | nadpis H1                          | `black` (`slate-950`)                           |
| `#0F172B`        | názov „Locale“ v logu              | `slate.9` (`slate-900`)                         |
| `#1D293D` (50 %) | placeholder v inpute               | `slate.8` (`slate-800`)                         |
| `#314158`        | label poľa                         | `slate.7` (`slate-700`)                         |
| `#62748E`        | základný text, odstavec            | `slate.5` (`slate-500`), `--mantine-color-text` |
| `#90A1B9`        | „WORKSPACE“, pätička               | `slate.4` (`slate-400`)                         |
| `#94A3B8`        | ikona zvončeka (Figma `28:27`)     | `slate.4` (najbližší odtieň)                    |
| `#E2E8F0`        | okraj inputu, okraj hornej lišty   | `slate.2` (`slate-200`)                         |
| `#F8FAFC`        | hlavička tabuľky, päta modálu      | `slate.0` (`slate-50`)                          |
| `#F1F5F9`        | okraj riadkov, pozadie avatara     | `slate.1` (`slate-100`)                         |
| `#45556C`        | iniciály v tabuľke                 | `slate.6` (`slate-600`)                         |
| `#475569`        | text sekundárneho tlačidla         | `slate.6` (najbližší odtieň)                    |
| `#0F172B`        | pozadie avatara v menu             | `slate.9`                                       |
| `#E83E8C`        | tlačidlo, pozadie loga             | `brand.6` (`primaryColor`)                      |
| `#D72F7C`        | malý nadpis nad H1 („PRIHLÁSENIE“) | `brand.7`                                       |

Primárna farba `brand` má 10 odtieňov: `#FDEEF5`, `#FBD9E8`, `#F6B0D0`, `#F184B6`, `#ED5F9F`, `#EA4B93`, `#E83E8C`, `#D72F7C`, `#B9246A`, `#961A55`. Odtiene 6 a 7 sú z Figmy, ostatné sú dopočítané.

### Radius a tiene

| Figma                               | Kde                  | Theme                         |
| ----------------------------------- | -------------------- | ----------------------------- |
| 10 px                               | tlačidlo             | `radius.md` (`defaultRadius`) |
| 12 px                               | input, ikona loga    | `radius.lg`                   |
| drop shadow `0 4 11` `#E83E8C` 20 % | tlačidlo             | `shadows.primary`             |
| drop shadow `0 5 14` `#E83E8C` 30 % | ikona loga           | `shadows.primary-lg`          |
| 16 px                               | karta tabuľky, modál | `radius.xl`                   |
| shadow `0 24 80` `#0F172A` 18 %     | modál                | `shadows.modal`               |

Ostatné radiusy: `xs` 4 px, `sm` 8 px.

Sekundárne tlačidlo (`variant="default"`, Figma „Zrušiť“) má v theme okraj `slate.2` a text `slate.6`.

### Inputy

Prekrytie `Input` a `InputWrapper` v theme (`styles/components/Input.module.css`, `InputWrapper.module.css`), platí pre všetky textové polia:

| Figma                                          | Theme                                                        |
| ---------------------------------------------- | ------------------------------------------------------------ |
| výška 44 px, radius 12 px, padding 14 px       | `--input-height`, `radius.lg`, `--input-padding`             |
| biele pozadie, okraj `#E2E8F0`                 | `white`, `slate.2`                                           |
| text 12 px / 600, placeholder `#1D293D` s 50 % | `fontSizes.xs`, `slate.8` (placeholder cez `color-mix` 50 %) |
| label 12 / 16 / 600 `#314158`, medzera 8 px    | `fontSizes.xs`, `lineHeights.xs`, `slate.7`                  |

### Typografia

| Figma (veľkosť / riadok / váha)  | Kde                    | Theme                                             |
| -------------------------------- | ---------------------- | ------------------------------------------------- |
| 32 / 48 / 700, tracking −1,12 px | H1                     | `headings.sizes.h1`, `letter-spacing: -0.035em`   |
| 28 / 42 / 700, tracking −0,98 px | H1 stránky v layoute   | `headings.sizes.h2` (`PageIntro titleSize="h2"`)  |
| 18 / 28 / 700, tracking −0,36 px | nadpis modálu          | `fontSizes.lg`, CSS modul `CreateUserModal`       |
| 16 / 24 / 400                    | základný text          | `fontSizes.md`, `lineHeights.md` (1.5)            |
| 15 / 22,5 / 700                  | „Locale“ v logu        | CSS modul `Brand`                                 |
| 14 / 20 / 400                    | odstavec               | `fontSizes.sm`, `lineHeights.sm`                  |
| 12 / 18 / 600                    | tlačidlo (výška 40 px) | `fontSizes.xs`, prekrytie `Button` (veľkosť `md`) |
| 12 / 16 / 600                    | label                  | `fontSizes.xs`, `lineHeights.xs`                  |
| 11 / 16,5 / 400                  | pätička                | `fontSizes.2xs`                                   |
| 10 / 15 / 700, tracking 1,2 px   | malý nadpis nad H1     | `fontSizes.3xs`, `letter-spacing: 0.12em`         |
| 10 / 15 / 600, tracking 1,6 px   | „WORKSPACE“            | `fontSizes.3xs`, `letter-spacing: 0.16em`         |

## Stránka 404

Nie je vo Figme, je navrhnutá podľa login screenu: rovnaké pozadie, logo „Locale / WORKSPACE“ hore v strede, obsah v strede so šírkou 380 px (malý ružový nadpis, H1, odstavec), primárne tlačidlo **Späť na úvod** na `/` a pätička `© <rok> Locale`. Rozloženie je v `CenteredLayout` a hlavička obsahu v `PageIntro`, aby ich mohli použiť login a 403.

## Ikony

1. SVG sa exportuje z Figmy (Figma MCP) do `src/assets/icons/` (`logo.svg`, `arrow-right.svg`, `bell.svg`, `plus.svg`, `close.svg`). Farba ťahu sa v súbore nastaví na `white` (napr. `close.svg` má vo Figme `#90A1B9`), aby ju SVGR nahradil za `currentColor`.
2. `pnpm --filter frontend generate-icons` cez SVGR (`svgr.config.cjs`) vygeneruje TypeScript komponenty do `src/components/Icons/` a barrel `index.ts`, potom spustí ESLint a Prettier.
3. Farba `white` z Figmy sa nahradí za `currentColor`, ikona preberá farbu textu. Predvolená veľkosť je veľkosť z Figmy, mení sa cez `width` a `height`, `viewBox` zostáva.

Použitie: `import { Logo } from '@/components/Icons'`.

## Testy

Unit testy bežia cez `vp test` v jsdom. `src/test/setup.ts` načíta matchery `@testing-library/jest-dom`, i18n a doplní `matchMedia`, `ResizeObserver` a `scrollTo`, ktoré jsdom nemá. Po každom teste vyčistí `queryClient`, mock API, `localStorage` a vráti jazyk na `sk`.

- `renderApp(path)` (`test/renderApp.tsx`) vyrenderuje celú aplikáciu (Mantine s `env="test"`, Query, router s memory history) a vráti router.
- `mockApi(routes)` (`test/mockApi.ts`) nahradí adapter axios inštancie odpoveďami podľa kľúča `METHOD /url` (napr. `GET /auth/me`) a vráti zoznam odoslaných požiadaviek. Skratky `signedInAs(user)` a `signedOut()`, chyby cez `apiError(status, code)`.

## Inšpirácia

Štruktúra a štýl kódu vychádzajú z FE projektu Notino Landing (atoms, components, pages, Mantine theme, query keys, SVGR ikony). Nové repo na ňom nie je závislé.
