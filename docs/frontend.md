---
title: 'Frontend'
updated: 2026-10-17
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
| `generate-flags` | vygeneruje React komponenty kruhových vlajok zo SVG (viď Vlajky)                 |

## Štruktúra `src/`

| Priečinok     | Obsah                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `atoms/`      | malé obaly nad Mantine (`ButtonLink`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `components/` | zložené komponenty (`AppLayout`, `Sidebar`, `TopBar`, `UserMenu`, `LanguageSwitcher`, `ThemeSwitcher`, `Brand`, `CenteredLayout`, `PageIntro`, `RouteError`, `UsersTable`, `CreateUserModal`, komponenty jazykov (`LanguagesTable`, `LanguageFlag`, `AddLanguageModal`, `LanguageSettingsModal`, `ConfirmDeleteModal`, spoločný rám modálu `AppModal`), komponenty profilu (`ProfileForm`, `ProfileCard`, `ProfileSection`, `PersonalDetailsSection`, `PreferencesSection`, `SecuritySection`), komponenty nastavení projektu (`ProjectSettingsForm`, `ProjectBasicsSection`, `VariableProtectionSection`), `Icons/`, `Flags/`) |
| `pages/`      | obrazovky rout (`HomePage`, `LoginPage`, `UsersPage`, `LanguagesPage`, `ProfilePage`, `ForbiddenPage`, `NotFoundPage`, `ErrorPage`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `routes/`     | strom rout, guardy a router (`createAppRouter`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `api/`        | axios inštancia `http`, `queryClient`, `QUERY_KEYS`, auth hooky (`api/auth/`), hooky správy používateľov (`api/adminUsers/`), hooky profilu (`api/profile/`), hooky jazykov (`api/languages/`), hooky nastavení projektu (`api/projectSettings/`), 401 interceptor, `getApiErrorCode`, `getApiErrorDetails`                                                                                                                                                                                                                                                                                                                     |
| `lib/`        | `constants.ts`, `enum.ts`, nastavenie i18n, `ForbiddenError`, `formatDate`, `formatRelativeTime`, `utils.ts` (`isLanguage`, `isLightColor`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `locales/`    | preklady `sk.json`, `en.json`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `styles/`     | Mantine theme, globálne CSS s poradím vrstiev, prekrytia Mantine komponentov                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `assets/`     | `icons/` (zdrojové SVG z Figmy), `flags/` (kruhové vlajky circle-flags s licenciou)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `types/`      | typy iba pre FE (typované i18n kľúče)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `test/`       | `setup.ts`, `renderApp` a `mockApi` pre unit testy                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

Priečinok komponentu obsahuje `Component.tsx`, `types.ts` (props) a voliteľne `Component.module.css`. Komponenty sa exportujú ako default a importujú plnou cestou (`@/components/Brand/Brand`). Barrel súbor je iba `components/Icons/index.ts` (`components/Flags/` barrel nemá, `LanguageFlag` importuje vlajky plnou cestou).

## Routing

TanStack Router s routami v kóde (ADR 0002), jeden súbor na routu v `routes/`. Root route má kontext s `queryClient`.

| Cesta               | Route                                       | Stránka                                         | Prístup                                  |
| ------------------- | ------------------------------------------- | ----------------------------------------------- | ---------------------------------------- |
| `/login`            | `loginRoute`                                | `LoginPage`                                     | iba neprihlásený (prihlásený ide na `/`) |
| `/`                 | `indexRoute` pod `_authenticated`           | `HomePage` (vo Fáze 1 prázdna)                  | prihlásený                               |
| `/profile`          | `profileRoute` pod `_authenticated`         | `ProfilePage` (Môj profil)                      | prihlásený (`ADMIN` aj `EDITOR`)         |
| `/admin/users`      | `adminUsersRoute` pod `_authenticated`      | `UsersPage` (zoznam a vytvorenie používateľa)   | `ADMIN`, ostatní vidia `ForbiddenPage`   |
| `/languages`        | `languagesRoute` pod `_authenticated`       | `LanguagesPage` (správa jazykov)                | `ADMIN`, ostatní vidia `ForbiddenPage`   |
| `/project-settings` | `projectSettingsRoute` pod `_authenticated` | `ProjectSettingsPage` (Nastavenia projektu)     | `ADMIN`, ostatní vidia `ForbiddenPage`   |
| neexistujúca        | root                                        | `NotFoundPage` (`notFoundComponent` root route) | všetci                                   |

Chyba v `beforeLoad` alebo v komponente routy bez vlastného `errorComponent` zobrazí `ErrorPage` (`defaultErrorComponent` routera).

### Lazy routy (code splitting)

Komponenty stránok `/login`, `/profile`, `/admin/users`, `/languages` a `/project-settings` sa načítajú až pri prvej návšteve routy. Route súbor (`loginRoute.ts`, `adminUsersRoute.ts`) drží iba kritickú časť (`path`, `beforeLoad` guard, pri `/admin/users`, `/languages` a `/project-settings` aj `errorComponent`, aby sa 403 zobrazila bez čakania na chunk stránky) a cez `.lazy(() => import('@/routes/<route>.lazy').then((module) => module.Route))` pripojí súbor `<route>.lazy.ts`, ktorý obsahuje `createLazyRoute('<route id>')({ component })`. Route id je cesta vrátane pathless rodiča (`/_authenticated/admin/users`), typecheck preklep v id zachytí. `HomePage` (prázdna) a stránky 404, 403 a chybová stránka ostávajú v hlavnom chunku.

Knižnice sú v samostatných chunkoch cez `build.rolldownOptions.output.codeSplitting.groups` vo `vite.config.ts`: `react` (react, react-dom, scheduler), `mantine` (`@mantine/*`), `tanstack` (`@tanstack/*`) a `i18n-zod` (i18next, react-i18next, zod). Menia sa iba pri aktualizácii závislostí, takže ich prehliadač drží v cache aj po novom release aplikácie. Ostatné knižnice delí rolldown automaticky, takže tie, ktoré používajú iba lazy stránky (React Hook Form, resolver), ostávajú v lazy chunkoch. `chunkSizeWarningLimit` sa nemení.

Výsledok `pnpm --filter frontend build` (2026-10-16, minifikované / gzip):

| Chunk                                            | Pred rozdelením knižníc | Po rozdelení        |
| ------------------------------------------------ | ----------------------- | ------------------- |
| `index` (kód aplikácie)                          | 525 kB / 167 kB         | 71 kB / 27 kB       |
| zdieľaný chunk knižníc (`queryKeys`)             | 231 kB / 73 kB          | –                   |
| `react`                                          | –                       | 219 kB / 68 kB      |
| `mantine`                                        | –                       | 231 kB / 71 kB      |
| `tanstack`                                       | –                       | 110 kB / 36 kB      |
| `i18n-zod`                                       | –                       | 132 kB / 39 kB      |
| **JS pri štarte spolu** (vrátane runtime 0,7 kB) | **756 kB / 240 kB**     | **763 kB / 241 kB** |
| lazy: formuláre (`getApiErrorDetails`)           | 36 kB                   | 34 kB               |
| lazy: stránka Používatelia                       | 11 kB                   | 6 kB                |
| lazy: prihlásenie                                | 4 kB                    | 2 kB                |

Žiadny chunk nie je nad 500 kB a build nehlási kruhové závislosti medzi chunkmi. JS pri štarte je po rozdelení o 1 % väčší, lebo Mantine komponenty, ktoré používali iba lazy stránky, sú teraz v chunku `mantine`. Lazy chunky sa o to zmenšili.

Po pridaní stránky Môj profil (2026-10-17): lazy chunk stránky má 7 kB / 3 kB. Chunk `mantine` narástol na 258 kB / 78 kB (predtým 231 kB / 71 kB), lebo `Select` (Combobox) a `Switch` patria do skupiny `@mantine/*`. Kód aplikácie pri štarte rolldown rozdelil na `index` (19 kB) a zdieľaný chunk `queryKeys` (56 kB), spolu 75 kB / 28 kB. JS pri štarte je spolu 794 kB / 251 kB, teda o 31 kB / 10 kB (asi 4 %) viac ako pred stránkou. Je to vedome prijaté, hoci `Select` a `Switch` zatiaľ používa iba lazy stránka profilu. Ak bude JS pri štarte rásť ďalej, skupina `mantine` sa zúži na komponenty používané pri štarte.

Po pridaní stránky Jazyky (2026-10-17): lazy chunk stránky má 12,6 kB / 4,1 kB. Kód aplikácie pri štarte je jeden chunk `index` 90 kB / 32 kB (predtým `index` 25 kB + `queryKeys` 58 kB, spolu 83 kB / 31 kB), narástol najmä o preklady `languagesPage.*`. Chunk `mantine` má 264 kB / 80 kB (predtým 263 kB / 79 kB, pribudli `ActionIcon` a `Badge`). JS pri štarte je spolu 817 kB / 256 kB, o 8 kB / 1,3 kB viac ako pred stránkou.

Po pridaní sidebaru a kruhových vlajok (2026-10-17): chunk `mantine` má 276 kB / 82 kB (pribudli `AppShell` a `Burger`), `index` 90 kB / 32 kB. Lazy chunk stránky Jazyky má 18,5 kB / 5,5 kB (predtým 12,6 kB / 4,1 kB), lebo obsahuje SVG 9 kruhových vlajok namiesto `country-flag-icons`. Žiadny chunk nie je nad 500 kB.

Po pridaní stránky Nastavenia projektu (2026-10-17): lazy chunk stránky má 7,3 kB / 2,8 kB. Chunk `mantine` má 311 kB / 94 kB (predtým 276 kB / 82 kB), pribudli `ColorInput` (s `ColorPicker`) a `Tooltip`. `index` má 95 kB / 34 kB (predtým 91 kB / 33 kB, preklady `projectSettingsPage.*`). JS pri štarte je o 39 kB / 12 kB väčší, hoci `ColorInput` a `Tooltip` používa iba lazy stránka. Toto je rast, pri ktorom sa podľa odseku o stránke Môj profil má zúžiť skupina `mantine` (otvorený bod pre orchestrátora).

### Guardy

- `_authenticated` je pathless layout route (bez segmentu v URL) s komponentom `AppLayout`. Jej `beforeLoad` zavolá `queryClient.ensureQueryData(meQueryOptions)`. Pri 401 presmeruje na `/login` (bez `?redirect=`), iné chyby (5xx, nedostupný backend) pustí ďalej a zobrazí sa `ErrorPage`. Načítaného používateľa vráti do kontextu ako `context.user` pre podriadené routy.
- `/login`: `beforeLoad` skúsi načítať `me`. Ak sa podarí, presmeruje na `/`. Akákoľvek chyba (401, nedostupný backend) znamená, že sa zobrazí formulár.
- `/admin/users`, `/languages` a `/project-settings`: `beforeLoad` pre rolu inú ako `ADMIN` vyhodí `ForbiddenError`. `errorComponent` (`RouteError`) pre túto chybu zobrazí `ForbiddenPage` vnútri layoutu a URL ostáva rovnaká. Iné chyby zobrazí `ErrorPage` vnútri layoutu.
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

### Jazyky

| Hook                                         | Čo robí                                                                                                                                             |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `languagesQueryOptions`, `useLanguagesQuery` | `GET /api/admin/languages` (`LanguagesResponse`, základný jazyk prvý), kľúč `QUERY_KEYS.LANGUAGES()`, globálny `retry`                              |
| `useCreateLanguageMutation`                  | `POST /api/admin/languages` (`CreateLanguageRequest` → `Language`). Pri `409 LANGUAGE_TAKEN` tiež invalidácia (jazyk medzitým pridal iný admin)     |
| `useUpdateLanguageMutation`                  | `PATCH /api/admin/languages/:id` (`{ id, body: UpdateLanguageRequest }` → `Language`). Pri `404 NOT_FOUND` tiež invalidácia                         |
| `useDeleteLanguageMutation`                  | `DELETE /api/admin/languages/:id` (`204`). Pri `404 NOT_FOUND` a `409 LANGUAGE_IS_BASE` tiež invalidácia (základný jazyk medzitým zmenil iný admin) |

Po každej úspešnej mutácii sa invaliduje celý zoznam `QUERY_KEYS.LANGUAGES()` (zmena základného jazyka mení dva riadky naraz) a mutácia čaká na nové načítanie, kým skončí.

### Nastavenia projektu

| Hook                                                     | Čo robí                                                                                                                                                                 |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `projectSettingsQueryOptions`, `useProjectSettingsQuery` | `GET /api/admin/project` (`ProjectSettings`), kľúč `QUERY_KEYS.PROJECT_SETTINGS()`, globálny `retry`                                                                    |
| `useUpdateProjectSettingsMutation`                       | `PATCH /api/admin/project` (`UpdateProjectSettingsRequest` → `ProjectSettings`). Po úspechu invaliduje `PROJECT_SETTINGS` aj `LANGUAGES` a čaká na nové načítanie oboch |

`LANGUAGES` sa invaliduje, lebo zmena základného jazyka mení odznak Základný na stránke Jazyky.

### Profil

| Hook                                     | Čo robí                                                                                                                                                                                             |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profileQueryOptions`, `useProfileQuery` | `GET /api/profile` (`Profile`), kľúč `QUERY_KEYS.PROFILE()`, globálny `retry`                                                                                                                       |
| `useUpdateProfileMutation`               | `PATCH /api/profile` (`UpdateProfileRequest` → `Profile`). Po úspechu `setQueryData` pre `PROFILE` aj `AUTH.ME` (polia `AuthUser`), iniciály a meno v sidebari sa zmenia hneď bez ďalšieho requestu |

## Layout, sidebar a horná lišta

Prihlásené stránky majú `AppLayout` postavený na Mantine `AppShell` s `layout="alt"`: sidebar je fixný vľavo na celú výšku okna, horná lišta (64 px) a obsah sú vpravo od neho. Obsah routy je v `AppShell.Main` (`<main>`) a scrolluje celá stránka, sidebar a lišta ostávajú na mieste. Drobčeky a ikona `?` z Figmy zatiaľ nie sú.

**Úzke obrazovky (pod `md`, 62em):** sidebar je skrytý mimo obrazovky a otvára sa tlačidlom `Burger` vľavo v hornej lište (**Otvoriť navigáciu**, `aria-expanded`, `aria-controls` na sidebar). Otvorený sidebar má celú šírku obrazovky a vlastný `Burger` (**Zavrieť navigáciu**). Zatvorí sa aj po kliknutí na položku navigácie alebo **Môj profil**. Zatvorený sidebar má okrem posunu Mantine aj `visibility: hidden` (`data-collapsed`), aby jeho odkazy neboli v poradí tabulátora. Pri zatvorení sa fokus presunie na **Otvoriť navigáciu** v hornej lište, inak by ostal na skrytom prvku sidebaru.

### Sidebar

`Sidebar` podľa Figmy `3:1656` (v kontexte obrazovky `3:812`), iba so stránkami, ktoré existujú:

- šírka 236 px vrátane pravého okraja `--app-color-border` s 80 % krytím, padding 16 px, pozadie `--app-color-surface`. Element je `<aside>` (`AppShell.Navbar` s `component="aside"`).
- hore `Brand` (logo „Locale / WORKSPACE“) ako odkaz `Link` na `/` s prístupným menom „Locale – domovská stránka“. Vzhľad loga sa nemení (bez podčiarknutia a zmeny farby), pri fokuse z klávesnice má obrys. Na úzkej obrazovke klik na logo zavrie otvorený sidebar ako položky navigácie. `Brand` v `CenteredLayout` (login, chybové stránky) odkazom nie je.
- `<nav aria-label="Hlavná navigácia">` (odsadená 24 px od loga): položka **Jazyky** (`/languages`, ikona `Globe`), oddeľovač (`--app-color-border-subtle`, okraje 16 px), nadpis sekcie **SPRÁVA** (10 / 15 / 700, veľké písmená, rozostup 0,14 em, `--app-color-muted`) a zoznam s položkami **Používatelia** (`/admin/users`, ikona `Users` z položky Členovia) a **Nastavenia projektu** (`/project-settings`, ikona `Settings`, Figma `3:1726`), zoznam má `aria-labelledby` na nadpis sekcie. Všetky položky vidí iba `ADMIN`. `EDITOR` má prázdnu navigáciu bez nadpisu SPRÁVA.
- položka: odkaz TanStack Router `Link`, výška 44 px, padding 10 / 12 px, medzera 12 px, radius `lg`, text 16 / 24 `--mantine-color-text`, ikona 18 px `--app-color-muted`, medzi položkami 4 px. Hover `--app-color-surface-muted` (vo Figme nie je).
- aktívna položka podľa aktuálnej routy: `Link` jej sám nastaví `aria-current="page"` a `data-status="active"`. Pozadie `--app-color-brand-tint`, text `--app-color-eyebrow`, ikona a bodka 6 px vpravo `brand.6`.
- dole `UserMenu`

Vynechané, lebo ešte neexistujú: prepínač organizácie/projektu, Prehľad, Preklady, Aktivita, Členovia a box Chránené premenné.

### Používateľ v sidebari (`UserMenu`)

Blok podľa Figmy `3:1742`: padding 8 px, medzera 12 px, avatar 32 px (`--app-color-avatar`, iniciály 10 px / 700 biele cez `getInitials`, `aria-hidden`), meno 12 / 16 / 600 `--app-color-text-strong` (bez mena email, dlhý text sa skráti), pod ním globálna rola 10 / 15 `--app-color-muted` (`Administrátor` / `Editor`, kľúče `roles.<ROLE>`, rovnaké ako v karte profilu). Vpravo tlačidlo `⋯` (`ActionIcon` 32 px, ikona `DotsHorizontal`, `--app-color-muted`) s prístupným menom **Menu používateľa**. Klikateľné je iba `⋯`, nie celý riadok (prístupné meno celého riadku by sa líšilo od viditeľného mena).

Tlačidlo otvára Mantine `Menu` (nad tlačidlom, 240 px): email, **Môj profil** (všetky role, odkaz na `/profile`) a **Odhlásiť sa**. Chyba pri odhlásení sa ukáže ako notifikácia `errors.<CODE>`. Odkazy Používatelia a Jazyky sú v navigácii sidebaru, nie v menu.

### Horná lišta

`TopBar` je `AppShell.Header` podľa Figmy `3:817` bez drobčekov a ikony `?`: výška 64 px, pozadie `--app-color-surface` s 90 % krytím a `backdrop-filter: blur(8px)`, spodný okraj `--app-color-border` s 80 % krytím, vodorovný padding 32 px. Logo a menu používateľa sú v sidebari.

- vľavo `Burger` (iba pod `md`)
- vpravo:
    - `LanguageSwitcher`: Mantine `SegmentedControl` SK / EN. Volá `i18n.changeLanguage`, jazyk sa zmení bez reloadu a uloží do `localStorage['locale']`. Viditeľný text je skratka (pre čítačky skrytá cez `aria-hidden`), prístupné meno je názov jazyka v danom jazyku (`VisuallyHidden` s `lang`): rádio **Slovenčina** a **English** v oboch jazykoch UI (kľúče `topBar.languages.<jazyk>.label` a `.name`). Pred skratkou je vlajka (viď i18n).
    - `ThemeSwitcher`: prepínač svetlej a tmavej schémy (viď Farebné schémy), hneď za prepínačom jazyka.
    - zvonček notifikácií: iba statická ikona 18 px v boxe 38 × 38 px, farba `slate.4`, bez akcie a bez ružovej bodky (zatiaľ nie sú notifikácie)

## Prihlasovacia stránka

Podľa Figmy `5:2861`: `CenteredLayout`, `PageIntro` (Prihlásenie / Vitajte späť / popis), polia E-mail a Heslo, tlačidlo **Prihlásiť sa** so šípkou.

- React Hook Form + `zodResolver(loginRequestSchema)` zo `@locale/shared`. Chybové hlášky zodu sa cez `toValidationCode` prekladajú na `validation.<CODE>` (s `{{min}}` / `{{max}}`).
- Odpoveď `VALIDATION_ERROR` s `details` sa priradí k poliam (`setError`). Ostatné chyby sa zobrazia nad tlačidlom (Mantine `Alert`) ako `errors.<CODE>`. Pri 429 sa zobrazí `loginPage.form.rateLimited` so sekundami z hlavičky `Retry-After`, ak hlavička chýba, tak `errors.RATE_LIMITED`.
- Počas odosielania je tlačidlo v stave `loading` (zároveň `disabled`), formulár sa nedá odoslať dvakrát.
- Heslo je obyčajný `TextInput type="password"` bez prepínača viditeľnosti (Figma ho nemá).

## Stránka Používatelia

Podľa Figmy `28:2` bez drobčekov, vnútri `AppLayout` na route `/admin/users` (iba `ADMIN`, položka **Používatelia** v sekcii SPRÁVA sidebaru). Obsah má šírku najviac 1200 px a padding 32 px.

- Hlavička: `PageIntro` s `titleSize="h2"` (malý ružový nadpis „Správa“, H1 „Používatelia“ vo veľkosti 28 px, popis) a vpravo dole primárne tlačidlo **Vytvoriť používateľa** s ikonou `Plus`, ktoré otvorí modál.
- `UsersTable`: Mantine `Table` v karte (biela, okraj `slate.2`, radius `xl`). Hlavička tabuľky na pozadí `slate.0`, texty 10 px / 700 veľkými písmenami `slate.4`. Stĺpce **E-mail** (avatar 32 px s iniciálami z emailu cez `getInitials({ email, firstName: null, lastName: null })`, pozadie `slate.1`, text `slate.6`, `aria-hidden`, lebo vedľa je celý email) a **Vytvorený** (šírka 180 px, dátum cez `formatDate`). Riadky oddeľuje okraj `slate.1`. Poradie je z API (najnovší hore).
- Stavy, ktoré nie sú vo Figme: načítavanie (3 riadky Mantine `Skeleton`, tabuľka má `aria-busy`), prázdny zoznam (text v tabuľke) a chyba (text „Zoznam používateľov sa nepodarilo načítať.“, preklad `errors.<CODE>` a tlačidlo **Skúsiť znova**, ktoré zavolá `refetch`).

### Formátovanie dátumu

`lib/formatDate.ts`: `formatDate(isoDate, language)` cez `Intl.DateTimeFormat` s číselným dňom, mesiacom a rokom, bez dátumovej knižnice. Jazyk UI `sk` → `sk-SK` (`12. 10. 2026`, `3. 10. 2026`), `en` → `en-GB` (`12/10/2026`, `03/10/2026`). Neznámy jazyk použije `sk`. Tabuľka berie `i18n.language`, takže zmena jazyka preformátuje dátumy bez reloadu.

### Modál Nový používateľ

`CreateUserModal` podľa Figmy `28:191`, zložený z `Modal.Root` a podkomponentov (nadpis a popis v hlavičke, vlastná ikona `Close`):

- šírka 560 px, radius `xl`, biele pozadie obsahu aj hlavičky, okraj `slate.2`, tieň `shadows.modal`, overlay `theme.black` s 25 % krytím a rozmazaním 2 px
- hlavička: nadpis „Nový používateľ“ 18 / 28 / 700 `slate.9`, popis 14 px, zatváracie tlačidlo 34 px s ikonou `slate.4`, spodný okraj `slate.1`
- polia **E-mail** (placeholder `meno@firma.sk`) a **Heslo** (`TextInput type="password"`, placeholder `Min. {{min}} znakov` s `PASSWORD_MIN_LENGTH`; Figma má „Min. 6“, platí konštanta)
- päta s pozadím `slate.0` (60 %): **Zrušiť** (`variant="default"`) a **Vytvoriť používateľa**

Správanie:

- React Hook Form + `zodResolver(createUserRequestSchema)` zo `@locale/shared`, chyby zodu cez `toValidationCode` → `validation.<CODE>` (s `{{min}}` / `{{max}}`). Odoslaný email je normalizovaný (trim, malé písmená).
- `400 VALIDATION_ERROR` s `details` → `setError` pri poliach. `409 EMAIL_TAKEN` → `errors.EMAIL_TAKEN` pri poli E-mail. Iné chyby → červená Mantine notifikácia `errors.<CODE>`, modál ostáva otvorený.
- Počas odosielania je tlačidlo v stave `loading` (aj `disabled`) a `onSubmit` počas bežiacej mutácie nič neurobí, formulár sa nedá odoslať dvakrát.
- Počas odosielania sa modál nedá zavrieť: **Zrušiť** a krížik sú `disabled`, `Esc` a klik mimo modálu sú vypnuté (`closeOnEscape`, `closeOnClickOutside`). Inak by zatvorenie resetovalo mutáciu a stratila by sa notifikácia o úspechu alebo chybe.
- Po úspechu: invalidácia zoznamu, zelená notifikácia „Používateľ {{email}} bol vytvorený.“, reset formulára a zatvorenie modálu. **Zrušiť**, krížik, `Esc` aj klik mimo modálu formulár tiež resetujú.

## Stránka Jazyky

Podľa Figmy `3:812` bez drobčekov a ikony `?`, vnútri `AppLayout` na route `/languages` (iba `ADMIN`, položka **Jazyky** v sidebari). Obsah má šírku najviac 1200 px a padding 32 px ako stránka Používatelia. Jazyky sú zatiaľ globálny zoznam (projekty ešte nie sú), pridať sa dá iba jazyk z katalógu `SUPPORTED_LANGUAGES` v `@locale/shared`.

- Hlavička: `PageIntro` s `titleSize="h2"` (Lokalizácia / Jazyky / popis z Figmy) a vpravo primárne tlačidlo **Pridať jazyk** s ikonou `Plus`. Tlačidlo je disabled, kým sa zoznam nenačíta, a keď sú pridané všetky jazyky z katalógu.
- `LanguagesTable`: karta ako pri používateľoch, stĺpec **Jazyk** a úzky stĺpec s menu, ktorého hlavička má len skrytý text „Akcie“ (`VisuallyHidden`) pre čítačky obrazovky. Riadok má výšku 78 px: kruhová vlajka 40 px (`LanguageFlag`), anglický názov 14 / 20 / 600 a pod ním pôvodný názov a tag (`slovenčina · sk`, 10 px `--app-color-muted`), pri základnom jazyku odznak **ZÁKLADNÝ** (Mantine `Badge`, 64 × 22 px ako Figma `3:885`, text 9 / 13,5 / 700, pozadie `--app-color-brand-tint`, text `--app-color-eyebrow`). Odznak má pevnú výšku 22 px, bez okraja Mantine a s horným paddingom 1 px, aby boli veľké písmená opticky v strede (pri symetrickom paddingu boli asi o 1 px vyššie). `line-height` ostáva 1,5, lebo label odznaku má `overflow: hidden` a nižší riadok by orezal dĺžne nad Á a Ý. Vpravo tlačidlo `⋯` (ikona `DotsHorizontal`, 34 px, `--app-color-muted`, prístupné meno „Akcie pre jazyk {{name}}“) s Mantine `Menu`: **Upraviť** a **Odstrániť** (červené, pri základnom jazyku disabled). Poradie je z API (základný prvý, potom podľa tagu).
- Stavy mimo Figmy: načítavanie (3 riadky `Skeleton`, `aria-busy`), prázdny zoznam (text „Zatiaľ nemáte žiadne jazyky.“ a tlačidlo **Pridať jazyk**) a chyba (text „Zoznam jazykov sa nepodarilo načítať.“, `errors.<CODE>` a **Skúsiť znova**).
- Názvy jazykov sú dáta z API, neprekladajú sa. Ostatné texty sú pod kľúčmi `languagesPage.*`.

Odchýlky od Figmy (rozhodnuté v pláne `docs/plans/languages.md`): chýbajú stĺpce **Preložené**, **Na kontrolu** a **Pokrytie** (preklady ešte nie sú), namiesto textového odznaku `SK` je kruhová vlajka, druhý riadok ukazuje pôvodný názov a tag (Figma „Zdrojový jazyk“ alebo tag).

### Vlajky

Vlajky na stránke Jazyky sú SVG z [HatScripts/circle-flags](https://github.com/HatScripts/circle-flags), navrhnuté ako kruhové. Licencia MIT, text licencie je v `src/assets/flags/LICENSE.md` vedľa zdrojových SVG (`at`, `bg`, `cz`, `gb`, `hr`, `hu`, `ro`, `ru`, `sk`). Grafika vlajok sa neupravuje.

- `pnpm --filter frontend generate-flags` cez SVGR (`svgr.flags.config.cjs`) vygeneruje komponenty do `src/components/Flags/` (`At.tsx`, `Sk.tsx`, …, bez barrel súboru), potom spustí ESLint a Prettier.
- Každé SVG sa orezáva na kruh cez `<mask id="a">`. Konfigurácia nahradí `id="a"` a `mask="url(#a)"` hodnotou z `useId()` (vlastný SVGR `template`), takže každá inštancia vlajky má vlastnú masku a viac vlajok na stránke (aj tá istá vlajka v tabuľke a v selecte) nezdieľa jedno `id`. Overuje to test `LanguageFlag.test.tsx`.
- Konfigurácia má `runtimeConfig: false`, inak by `@svgr/core` pri každom súbore znova našiel `svgr.config.cjs` ikon a jeho nastavenia (`#fff` → `currentColor`, rozmery) by vyhrali.
- Nová vlajka: SVG z circle-flags do `src/assets/flags/`, `generate-flags`, import v `LanguageFlag`.

`LanguageFlag` mapuje kód vlajky z kontraktu (`LanguageFlagCode`, malé písmená `gb`, `cz`, `at`, …) na tieto komponenty. Nový kód vlajky v katalógu bez mapovania zachytí `typecheck` (`satisfies Record<LanguageFlagCode, …>`). Vlajka je dekoratívna (`aria-hidden`) a má 1px prstenec `--app-color-border`.

- `size="lg"`: 40 px v tabuľke.
- `size="sm"`: 20 px v selectoch (položky a náhľad zvolenej hodnoty vľavo v poli). Aj tu je kruhová vlajka, aby bola rovnaká ako v tabuľke.

Obdĺžnikové vlajky `country-flag-icons` ostávajú iba v prepínači jazyka v hornej lište.

### Modály jazykov

Modály nie sú vo Figme, majú rovnaký rám ako **Nový používateľ** (`AppModal`: šírka 560 px, nadpis, popis, krížik, päta s tlačidlami, počas requestu sa nedajú zavrieť).

- **Pridať jazyk** (`AddLanguageModal`): Mantine `Select` so `searchable`, položky „vlajka · English name – native name – tag“ zo `SUPPORTED_LANGUAGES`. Hľadá sa v celom texte položky, teda v anglickom aj pôvodnom názve aj v tagu. Už pridané jazyky sú v zozname disabled. **Pridať** je disabled bez výberu a `loading` počas requestu. Úspech → zelená notifikácia „Jazyk {{name}} bol pridaný.“, zatvorenie a reset. `400` → chyba pri poli. `409 LANGUAGE_TAKEN` → `errors.LANGUAGE_TAKEN` pri poli **Jazyk** (bez notifikácie, ako `EMAIL_TAKEN` v Novom používateľovi), výber sa vymaže, takže **Pridať** je disabled; po novom načítaní zoznamu je jazyk v zozname disabled a výber iného jazyka chybu zmaže. Iná chyba → červená notifikácia `errors.<CODE>`, modál ostáva otvorený.
- **Nastavenia jazyka** (`LanguageSettingsModal`, z menu **Upraviť**): React Hook Form + `zodResolver(updateLanguageRequestSchema)`, predvyplnené z riadku. Polia **Anglický názov**, **Pôvodný názov**, **Vlajka** (`Select` z `LANGUAGE_FLAG_CODES`, názov krajiny cez `Intl.DisplayNames` v jazyku UI, napr. „Slovensko (SK)“, s náhľadom vlajky) a **Tag** (disabled, popis „Tag sa nedá zmeniť.“ je pod poľom, aby boli **Vlajka** a **Tag** v jednom riadku zarovnané). Prepínač **Základný jazyk** sa dá iba zapnúť (pošle `isBase: true`), pri základnom jazyku je zapnutý a disabled. Päta: **Odstrániť jazyk** vľavo (disabled pri základnom jazyku), **Zrušiť**, **Uložiť** (disabled, kým sa formulár nezmení). Úspech → zelená notifikácia „Jazyk {{name}} bol uložený.“ a zatvorenie. `400` → `setError` pri poliach podľa `details`, `404` → červená notifikácia, nové načítanie zoznamu a až potom zatvorenie (fokus tak ide na tabuľku, nie na `⋯` riadku, ktorý zmizne), iné → červená notifikácia.
- **Odstrániť jazyk** (`ConfirmDeleteModal`, šírka 440 px): každé odstránenie (z menu riadku aj z Nastavení) ide cez potvrdenie „Naozaj chcete odstrániť jazyk {{name}} ({{tag}})?“ s tlačidlami **Zrušiť** a červeným **Odstrániť** (`loading`). Úspech → zelená notifikácia „Jazyk {{name}} bol odstránený.“ a zatvoria sa oba modály. `404` zatvorí oba modály s červenou notifikáciou, iné chyby (`409 LANGUAGE_IS_BASE`) ukážu červenú notifikáciu a potvrdenie ostane otvorené. Pri `409 LANGUAGE_IS_BASE` sa zoznam načíta znova, takže riadok dostane odznak **Základný** a **Odstrániť** v jeho menu je disabled.
- Potvrdenie sa otvára nad Nastaveniami (`zIndex` o 1 vyšší). Mantine počúva `Esc` na `window`, takže kým je potvrdenie otvorené, Nastavenia majú vypnuté `Esc`, klik mimo a focus trap (`inBackground`), inak by `Esc` zavrel oba modály. `Modal.Stack` sa nepoužil, lebo funguje iba s `Modal`, nie s `Modal.Root`.
- Fokus po zatvorení: Mantine vracia fokus na prvok, ktorý mal fokus pri otvorení modálu, čo je pri otvorení z menu riadku už zatvorená položka menu. `LanguagesPage` si preto pamätá tlačidlo, ktoré modál otvorilo (`⋯` riadku, **Pridať jazyk** v hlavičke alebo v prázdnom stave), a po zatvorení vráti fokus naň. Ak tlačidlo zmizlo alebo je disabled (riadok sa odstránil, prázdny stav po pridaní jazyka, pridaný posledný jazyk z katalógu), fokus dostane tabuľka (`tabIndex={-1}`, prístupné meno „Zoznam jazykov“). Po odstránení jazyka ide fokus vždy na tabuľku. Potvrdenie otvorené z Nastavení vracia fokus do Nastavení (Mantine).

## Stránka Môj profil

Podľa Figmy `3:1762` bez sidebaru, drobčekov a ikony `?`, vnútri `AppLayout` na route `/profile` (ADMIN aj EDITOR). Obsah má šírku najviac 980 px a padding 32 px, karty sú pod sebou s medzerou 20 px. MVP ukladá iba meno a priezvisko, ostatné prvky sú zobrazené ako Mantine `disabled` (bez tooltipu a vysvetľujúceho textu).

- Hlavička: `PageIntro` s `titleSize="h2"` (Používateľský účet / Môj profil / popis).
- `ProfileCard`: hlavička 112 px s ružovým gradientom (`--app-color-brand-tint` → `--app-color-surface-muted`, svetlá `brand.0` → `slate.0`, tmavá stlmená ružová → `dark.7`), avatar 88 px (`--app-color-avatar`, okraj 4 px `--app-color-surface`, radius `xl`, iniciály 20 px / 700 cez `getInitials`, `aria-hidden`, lebo hneď za ním je nadpis s celým menom), meno 18 / 28 / 700 (bez mena sa zobrazí email) a globálna rola (`Administrátor` / `Editor`, kľúče `roles.<ROLE>`, rovnaké ako v sidebari). Tlačidlo **Zmeniť fotografiu** s ikonou `Upload` je disabled. Karta zobrazuje uložené údaje, nie rozpísaný formulár.
- **Osobné údaje** (`PersonalDetailsSection` v karte `ProfileSection`): **Meno** a **Priezvisko** sú editovateľné, **E-mailová adresa** je disabled s emailom používateľa, **Pracovná pozícia** je disabled a prázdna s placeholderom „Napr. Product manager“ (pole v DB neexistuje). Dve stĺpce od šírky `sm`.
- **Preferencie** (`PreferencesSection`): **Jazyk rozhrania** je Mantine `Select` (Slovenčina / English, kľúče `topBar.languages.<jazyk>.name`, šípka `ChevronDown` z Figmy). Zmena volá `i18n.changeLanguage` rovnako ako `LanguageSwitcher` v hornej lište, jazyk sa prepne hneď a uloží do `localStorage`, nie cez **Uložiť profil**. **E-mailové oznámenia**: tri disabled `Switch` (všetky vypnuté) s popisom, skupina má `role="group"` s nadpisom ako menom. Mantine dáva popis do `<label>`, takže je súčasťou prístupného mena prepínača.
- **Heslo a zabezpečenie** (`SecuritySection`): ikona `Shield`, text „Heslo bolo naposledy zmenené {{relative}}.“ z `passwordChangedAt` cez `formatRelativeTime`, tlačidlo **Zmeniť heslo** je disabled.
- **Uložiť profil** vpravo dole: React Hook Form + `zodResolver(updateProfileRequestSchema)` zo `@locale/shared` (chyby cez `toValidationCode` → `validation.<CODE>`), polia predvyplnené z profilu (`null` → prázdny reťazec). Tlačidlo je disabled, kým sa formulár nezmení (`isDirty`), počas requestu je `loading` a druhé odoslanie sa ignoruje. Úspech → zelená notifikácia „Profil bol uložený.“ a `reset` na uložené hodnoty. `400 VALIDATION_ERROR` → `setError` pri poliach podľa `details`, iná chyba → červená notifikácia `errors.<CODE>`.
- Stavy mimo Figmy: načítavanie (4 Mantine `Skeleton` vo výške kariet, kontajner má `aria-busy`) a chyba načítania (text „Profil sa nepodarilo načítať.“, preklad `errors.<CODE>` a tlačidlo **Skúsiť znova**, ktoré zavolá `refetch`).

Odchýlky od Figmy: polia a select majú výšku 44 px a text 12 px / 600 z theme (Figma 40 px, select 16 px), prepínače majú Mantine veľkosť `md` (46 × 24 px, Figma 44 × 24 px), disabled prvky majú vzhľad Mantine `disabled`, pri role chýba „· Organizácia1“ (organizácie ešte nie sú). Tmavá schéma nie je vo Figme, farby stránky idú cez premenné `--app-color-*` (viď Farebné schémy).

## Stránka Nastavenia projektu

Podľa Figmy `3:1557` bez drobčekov, ikony `?` a zvončeka, doplnená o **Základný jazyk** a **Opustiť projekt** (plán `docs/plans/project-settings.md`). Vnútri `AppLayout` na route `/project-settings`, iba `ADMIN` (položka v sidebari v sekcii SPRÁVA). Obsah má šírku najviac 980 px a padding 32 px, karty sú pod sebou s medzerou 20 px. Projekt je zatiaľ jeden, stránka načíta `useProjectSettingsQuery` aj `useLanguagesQuery`.

- Hlavička: `PageIntro` s `titleSize="h2"` (Konfigurácia / Nastavenia projektu / popis z Figmy).
- **Základné údaje** (`ProjectBasicsSection` v karte `ProfileSection`): riadky „label vľavo 180 px, pole vpravo“ (mriežka, medzery 24 / 20 px). Label je `<label for>` 12 px / 600 `--app-color-text-secondary`.
    - **Názov projektu** a **Slug projektu** (`TextInput`). Pod slugom nápoveda „Používa sa pri pomenovaní exportovaných súborov.“ (10 px `--app-color-muted`, prepojená cez `aria-describedby`).
    - **Primárna farba**: Mantine `ColorInput` (`format="hex"`, bez kvapkadla, `fixOnBlur={false}`, aby neplatná farba ukázala chybu pri poli a nevrátila sa potichu) a vedľa štítok **Ukážka** s pozadím vo zadanej farbe. Kým zadaná farba nie je platná `#RRGGBB` (`hexColorSchema`), štítok ukazuje uloženú farbu. Text štítka je čierny alebo biely podľa jasu farby (`isLightColor` v `lib/utils.ts`, YIQ, prah 128), v oboch schémach rovnako, lebo leží na farbe používateľa.
    - **Základný jazyk**: `Select` s jazykmi z `languagesQuery` (popis „English (en)“, v zozname a vľavo v poli kruhová vlajka `LanguageFlag`), predvyplnený `baseLanguageId`. Bez jazykov je disabled s nápovedou „Zatiaľ nemáte žiadne jazyky.“ a odkazom **Pridať jazyk** na `/languages`. Formulár sa vtedy nedá uložiť (`baseLanguageId` je v kontrakte povinné).
- **Ochrana dynamických segmentov** (`VariableProtectionSection`, karta `ProfileSection` s `withDivider={false}`, bez čiary pod hlavičkou ako vo Figme): `Switch` veľkosti `md` vpravo v boxe `--app-color-surface-muted` (padding 16 px, radius `lg`), label „Chrániť výrazy {{ variable }}“ s popisom. Text `{{ variable }}` ide do prekladu ako parameter `example`, inak by ho i18next bral ako vlastnú premennú. Nastavenie sa iba ukladá, editor prekladov ešte neexistuje.
- Pätička: vľavo **Opustiť projekt** (`Button variant="outline"`) s `Tooltip` „Bude dostupné spolu so správou členov“, vpravo **Uložiť zmeny**. Opustiť projekt nemá `disabled`, ale `data-disabled` a `aria-disabled` s `preventDefault` pri kliknutí, lebo disabled tlačidlo nevyvolá `mouseleave` a tooltip by sa nezobrazil (odporúčanie Mantine). Tooltip sa ukáže aj pri fokuse z klávesnice.
- **Uložiť zmeny**: React Hook Form + `zodResolver(updateProjectSettingsRequestSchema)` (chyby cez `toValidationCode` → `validation.<CODE>`). Disabled, kým sa formulár nezmení, počas requestu `loading` a druhé odoslanie sa ignoruje. Úspech → zelená notifikácia „Nastavenia projektu boli uložené.“ a `reset` na hodnoty z odpovede. `400 VALIDATION_ERROR` → `setError` pri poliach podľa `details`, iná chyba (napr. `404 NOT_FOUND`) → červená notifikácia `errors.<CODE>`.
- Stavy mimo Figmy: načítavanie (2 `Skeleton` vo výške kariet, `aria-busy`), chyba načítania nastavení alebo jazykov (text „Nastavenia projektu sa nepodarilo načítať.“, `errors.<CODE>` a **Skúsiť znova**, ktoré znova načíta, čo zlyhalo, a po úspechu dá fokus na Názov projektu). Chyba pri obnovení na pozadí (dáta už sú) formulár neskryje.

Odchýlky od Figmy: polia majú výšku 44 px a text 12 px / 600 z theme (Figma 40 px a 16 px), štvorček farby a hex pole sú jeden `ColorInput` (Figma má dva prvky, 48 px a 128 px), pribudli riadok Základný jazyk a tlačidlo Opustiť projekt (zo screenshotu iného systému), prepínač je 46 × 24 px (Figma 44 × 24 px). Tmavá schéma nie je vo Figme, farby idú cez `--app-color-*`.

### Relatívny čas

`lib/formatRelativeTime.ts`: `formatRelativeTime(isoDate, language, now?)` cez `Intl.RelativeTimeFormat` (`numeric: 'auto'`) s rovnakým mapovaním jazyka ako `formatDate` (`toIntlLocale`: `sk` → `sk-SK`, `en` → `en-GB`, neznámy → `sk`). Vyberie najväčšiu jednotku, ktorá sa zmestí (rok 365 dní, mesiac 30 dní, týždeň, deň, hodina, minúta, sekunda), a zaokrúhli: `pred 3 mesiacmi` / `3 months ago`, `včera` / `yesterday`, `teraz` / `now`.

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
- Prepínač jazyka ukazuje pred skratkou vlajku z balíka `country-flag-icons` (MIT, React SVG komponenty `country-flag-icons/react/3x2`): `SK` pre slovenčinu, `GB` pre angličtinu (angličtina používa britské formáty `en-GB`). Vlajka má 16 px na šírku (pomer 3 : 2), radius 2 px a 1px prstenec `--app-color-border`, aby boli biele časti vidieť aj vo svetlej schéme. Je dekoratívna (`aria-hidden`), prístupné mená rádií sa nemenia. Mapovanie jazyk → vlajka je `LANGUAGE_FLAG` v `LanguageSwitcher.tsx`, nový jazyk potrebuje aj vlajku.
- Kľúče sú typované podľa `sk.json` (`types/i18next.d.ts`), preklep v kľúči zachytí `typecheck`. Kľúč chýbajúci v `en.json` typecheck nezachytí (spadol by na `sk`), preto ho stráži test vyššie.

## Štýly

- Poradie vrstiev v `styles/global.css`: `theme, base, mantine, components, utilities`. Tailwind preflight (`base`) je pod Mantine, takže nerozbije jeho komponenty. Tailwind utility sú nad Mantine.
- Mantine má prednosť: theme a prekrytia komponentov (`styles/mantineTheme.ts`), potom CSS moduly, Tailwind iba na layout a spacing.
- `Modal` (aj `Modal.Root`) má v theme `content` a `header` na pozadí `--app-color-surface` (`styles/components/Modal.module.css`). Mantine ich inak farbí `--mantine-color-body`, čo je tu sivé pozadie stránky.
- Font DM Sans sa hostuje lokálne z balíka `@fontsource-variable/dm-sans`. Nastavuje sa v Mantine theme (`fontFamily`, `headings.fontFamily`) aj v Tailwind `--font-sans`.
- Aplikácia má svetlú a tmavú schému, farby v komponentoch idú cez premenné `--app-color-*` (viď Farebné schémy).

## Farebné schémy

Svetlá (predvolená, podľa Figmy) a tmavá schéma cez vstavanú podporu Mantine. Tmavá schéma nie je vo Figme, je odvodená zo `slate` palety. Voľba „auto“ (podľa systému) v UI nie je.

- Prepína sa tlačidlom `ThemeSwitcher` v hornej lište (Mantine `ActionIcon` 38 × 38 px, ikona 18 px `--app-color-muted`). Vo svetlej schéme ukazuje mesiac s menom **Prepnúť na tmavý režim** / **Switch to dark mode**, v tmavej slnko s menom **Prepnúť na svetlý režim** / **Switch to light mode** (kľúče `topBar.theme.toDark` a `topBar.theme.toLight`). Volá `setColorScheme` z `useMantineColorScheme`, aktuálnu schému číta `useComputedColorScheme`.
- `MantineProvider` dostane `colorSchemeManager` (`localStorageColorSchemeManager`) a `defaultColorScheme='light'` (`DEFAULT_COLOR_SCHEME`). Voľba sa ukladá do `localStorage['mantine-color-scheme-value']` (predvolený kľúč Mantine, `COLOR_SCHEME_STORAGE_KEY`) a Mantine nastaví na `<html>` atribút `data-mantine-color-scheme="light|dark"`.
- Inline skript v `frontend/index.html` (obdoba `ColorSchemeScript` z Mantine pre aplikáciu bez SSR) nastaví atribút ešte pred prvým vykreslením, takže po reloade v tmavej schéme nebliká svetlá. Kľúč a predvolená hodnota sú v skripte napísané natvrdo, pri zmene `COLOR_SCHEME_STORAGE_KEY` alebo `DEFAULT_COLOR_SCHEME` treba zmeniť aj skript.
- Kým sa nenačíta JS aplikácie, má stránka v tmavej schéme pozadie z CSS Mantine (`#242424`), naše premenné vkladá `MantineProvider` až pri prvom rendri. Je to tmavé, svetlé bliknutie nevzniká.

### Premenné schémy

Komponenty a CSS moduly nepoužívajú priamo `slate.N`, `black` ani `white`, ale premenné `--app-color-*` z `cssVariablesResolver` v `styles/mantineTheme.ts`. Svetlé hodnoty sú presne farby z Figmy.

| Premenná                         | Kde                                                                                                                                                               | Svetlá                | Tmavá                                    |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ---------------------------------------- |
| `--mantine-color-body`           | pozadie stránky                                                                                                                                                   | `#F7F8FB`             | `#020618` (`slate-950`)                  |
| `--mantine-color-text`           | základný text, odstavec                                                                                                                                           | `slate.5`             | `slate.4`                                |
| `--app-color-surface`            | karta tabuľky, modál, horná lišta (90 %), sidebar, input, karty profilu, okraj avatara profilu                                                                    | `white`               | `slate.9`                                |
| `--app-color-surface-muted`      | hlavička tabuľky, hover položky sidebaru, päta modálu (60 %), koniec gradientu karty profilu                                                                      | `slate.0`             | `#0B1222` (`dark.7`)                     |
| `--app-color-border`             | okraj inputu, karty, modálu, lišty, sidebaru (80 %), sekundárneho tlačidla, prstenec vlajky                                                                       | `slate.2`             | `slate.7`                                |
| `--app-color-border-subtle`      | okraj riadkov tabuľky, oddeľovač v sidebari, oddeľovače v modáli, oddeľovač hlavičky sekcie profilu                                                               | `slate.1`             | `slate.8`                                |
| `--app-color-heading`            | H1                                                                                                                                                                | `black` (`slate-950`) | `slate.0`                                |
| `--app-color-title`              | „Locale“ v logu, nadpis modálu, meno a nadpisy sekcií profilu                                                                                                     | `slate.9`             | `slate.1`                                |
| `--app-color-text-strong`        | text v inpute (placeholder 50 %), emaily, titulok chyby tabuľky a profilu                                                                                         | `slate.8`             | `slate.2`                                |
| `--app-color-label`              | label poľa, label prepínača v profile                                                                                                                             | `slate.7`             | `slate.3`                                |
| `--app-color-text-secondary`     | text sekundárneho tlačidla, iniciály v tabuľke, labely v Preferenciách                                                                                            | `slate.6`             | `slate.3`                                |
| `--app-color-muted`              | „WORKSPACE“, ikony a nadpis SPRÁVA v sidebari, rola v sidebari, pätička, hlavička tabuľky, zvonček, prepínač schémy, krížik, popisy a rola v profile, ikona štítu | `slate.4`             | `slate.5`                                |
| `--app-color-eyebrow`            | malý nadpis nad H1, text aktívnej položky sidebaru, text odznaku ZÁKLADNÝ                                                                                         | `brand.7`             | `brand.4`                                |
| `--app-color-avatar`             | avatar v sidebari a v karte profilu (iniciály biele)                                                                                                              | `slate.9`             | `slate.7`                                |
| `--app-color-avatar-muted`       | avatar v tabuľke                                                                                                                                                  | `slate.1`             | `slate.8`                                |
| `--app-color-brand-tint`         | pozadie aktívnej položky sidebaru, začiatok gradientu karty profilu (stred cez `color-mix` 60 % s `--app-color-surface-muted`), odznak ZÁKLADNÝ                   | `brand.0`             | `brand.9` 30 % + `slate.9` (`color-mix`) |
| `--mantine-color-error`          | okraj a text chyby poľa                                                                                                                                           | `red.6` (Mantine)     | `red.6`                                  |
| `--mantine-color-disabled`       | pozadie disabled tlačidla, inputu a dráhy prepínača                                                                                                               | `gray.2` (Mantine)    | `dark.5` (`slate-800`)                   |
| `--mantine-color-disabled-color` | text disabled tlačidla a inputu                                                                                                                                   | `gray.5` (Mantine)    | `dark.2` (`slate-400`)                   |

- Primárna `brand` sa nemení. Ružový malý nadpis má v tmavej `brand.4` (kontrast asi 6,5 : 1 na `slate-950`, `brand.7` by mal iba 4,4 : 1). Chyba poľa je v tmavej `red.6`, lebo predvolená `red.8` z Mantine má na `slate.9` menej ako 4,5 : 1. Disabled prvky majú v tmavej `dark.5` a `dark.2`: predvolené `dark.6` z Mantine je tu `slate-900`, teda rovnaké ako pozadie karty, a disabled tlačidlá a dráhy prepínačov by na karte zanikli. Svetlá schéma ostáva na predvolených hodnotách Mantine.
- Ikona loga má farbu `--mantine-primary-color-contrast` (biela v oboch schémach).
- Mantine vlastné komponenty (`SegmentedControl`, `Menu`, `Notification`, `Skeleton`, `Alert`, sekundárne tlačidlo) farbia tmavú schému paletou `dark`. Tá je v theme nahradená odtieňmi `slate`: `#E2E8F0`, `#CAD5E2`, `#90A1B9`, `#62748E`, `#314158`, `#1D293D`, `#0F172B`, `#0B1222`, `#070E1D`, `#020618` (napr. `dark.4` okraje = `slate-700`, `dark.6` pozadie dropdownu a sekundárneho tlačidla = `slate-900`). Svetlá schéma paletu `dark` nepoužíva.

### Ako písať CSS pre obe schémy

- V CSS moduloch a v props `c` / `color` použite premennú `--app-color-*` (`color: var(--app-color-muted)`, `c='var(--app-color-text-strong)'`), nie `slate.N`, `black` ani `white`.
- Nová farba, ktorá sa v schémach líši: pridajte premennú do `light` aj `dark` v `cssVariablesResolver` a riadok do tabuľky vyššie.
- Jednorazová úprava iba pre tmavú schému: selektor `[data-mantine-color-scheme='dark'] .trieda { … }` v CSS module. Natívne `light-dark()` funguje tiež (Mantine nastavuje `color-scheme`), ale premenné majú prednosť, aby boli hodnoty na jednom mieste.

## Mapovanie Figma → theme

Farby v tejto sekcii a v popisoch obrazoviek vyššie sú hodnoty svetlej schémy, v kóde idú cez premenné `--app-color-*` (tmavé hodnoty sú v sekcii Farebné schémy).

Figma súbor nemá premenné. Hodnoty sú zo štýlov login screenu (node `5:2861`), stránky Používatelia (`28:2`), modálu (`28:191`) a stránky Jazyky (`3:812`) cez `get_design_context`.

### Farby

Šedé sú Tailwind v4 `slate`. V Mantine je to farba `slate`, index 0–9 = `slate-50` až `slate-900`. `slate-950` je `theme.black`.

| Figma                 | Kde                                       | Theme                                           |
| --------------------- | ----------------------------------------- | ----------------------------------------------- |
| `#F7F8FB`             | pozadie stránky                           | `--mantine-color-body`                          |
| `#020618`             | nadpis H1                                 | `black` (`slate-950`)                           |
| `#0F172B`             | názov „Locale“ v logu                     | `slate.9` (`slate-900`)                         |
| `#1D293D` (50 %)      | placeholder v inpute                      | `slate.8` (`slate-800`)                         |
| `#314158`             | label poľa                                | `slate.7` (`slate-700`)                         |
| `#62748E`             | základný text, odstavec                   | `slate.5` (`slate-500`), `--mantine-color-text` |
| `#90A1B9`             | „WORKSPACE“, pätička                      | `slate.4` (`slate-400`)                         |
| `#94A3B8`             | ikona zvončeka (Figma `28:27`)            | `slate.4` (najbližší odtieň)                    |
| `#E2E8F0`             | okraj inputu, okraj hornej lišty          | `slate.2` (`slate-200`)                         |
| `#F8FAFC`             | hlavička tabuľky, päta modálu             | `slate.0` (`slate-50`)                          |
| `#F1F5F9`             | okraj riadkov, pozadie avatara            | `slate.1` (`slate-100`)                         |
| `#FFF1F7` → `#F8FAFC` | gradient karty profilu                    | `brand.0` → `slate.0` (stred cez `color-mix`)   |
| `#45556C`             | iniciály v tabuľke                        | `slate.6` (`slate-600`)                         |
| `#475569`             | text sekundárneho tlačidla                | `slate.6` (najbližší odtieň)                    |
| `#0F172B`             | pozadie avatara v sidebari                | `slate.9`                                       |
| `#E83E8C`             | tlačidlo, pozadie loga                    | `brand.6` (`primaryColor`)                      |
| `#D72F7C`             | malý nadpis nad H1 („PRIHLÁSENIE“)        | `brand.7`                                       |
| `#FDF2F8`             | odznak ZÁKLADNÝ, aktívna položka sidebaru | `brand.0` (najbližší odtieň)                    |

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
| okraj poľa s chybou (Figma stav nemá)          | `--mantine-color-error`, aj bez fokusu                       |
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
| 9 / 13,5 / 700                   | odznak ZÁKLADNÝ        | `fontSizes.4xs`                                   |

## Stránka 404

Nie je vo Figme, je navrhnutá podľa login screenu: rovnaké pozadie, logo „Locale / WORKSPACE“ hore v strede, obsah v strede so šírkou 380 px (malý ružový nadpis, H1, odstavec), primárne tlačidlo **Späť na úvod** na `/` a pätička `© <rok> Locale`. Rozloženie je v `CenteredLayout` a hlavička obsahu v `PageIntro`, aby ich mohli použiť login a 403.

## Ikony

1. SVG sa exportuje z Figmy (Figma MCP) do `src/assets/icons/` (`logo.svg`, `arrow-right.svg`, `bell.svg`, `plus.svg`, `close.svg`, `upload.svg`, `shield.svg`, `chevron-down.svg`, `dots-horizontal.svg` z tlačidla `⋯` v riadku jazyka, Figma `3:901`, rovnaká ikona je aj v sidebari pri používateľovi, `globe.svg` z položky Jazyky v sidebari, Figma `3:1702`, `users.svg` z položky Členovia, Figma `3:1720`, `settings.svg` (ozubené koleso) z položky Nastavenia projektu, Figma `3:1726`). `sun.svg` a `moon.svg` (prepínač schémy) vo Figme nie sú, sú to jednoduché ikony 24 px v štýle Lucide s ťahom 1,8. Farba ťahu sa v súbore nastaví na `white` (napr. `close.svg` má vo Figme `#90A1B9`), aby ju SVGR nahradil za `currentColor`.
2. `pnpm --filter frontend generate-icons` cez SVGR (`svgr.config.cjs`) vygeneruje TypeScript komponenty do `src/components/Icons/` a barrel `index.ts`, potom spustí ESLint a Prettier.
3. Farba `white` z Figmy sa nahradí za `currentColor`, ikona preberá farbu textu. Predvolená veľkosť je veľkosť z Figmy, mení sa cez `width` a `height`, `viewBox` zostáva.

Použitie: `import { Logo } from '@/components/Icons'`.

## Testy

Unit testy bežia cez `vp test` v jsdom. `src/test/setup.ts` načíta matchery `@testing-library/jest-dom`, i18n a doplní `matchMedia`, `ResizeObserver`, `scrollTo` a `Element.scrollIntoView` (volá ho dropdown `Select`), ktoré jsdom nemá. Po každom teste vyčistí `queryClient`, mock API, `localStorage` a vráti jazyk na `sk`.

- `renderApp(path)` (`test/renderApp.tsx`) vyrenderuje celú aplikáciu (Mantine s `env="test"`, Query, router s memory history) a vráti router.
- `mockApi(routes)` (`test/mockApi.ts`) nahradí adapter axios inštancie odpoveďami podľa kľúča `METHOD /url` (napr. `GET /auth/me`) a vráti zoznam odoslaných požiadaviek. Skratky `signedInAs(user)` a `signedOut()`, chyby cez `apiError(status, code)`.

## Prístupnosť

Cieľ sú základy WCAG 2.2 úrovne AA. Kontroluje ich rola `accessibility-reviewer` (`.agents/agents/accessibility-reviewer.md`) a dve automatické kontroly:

- **ESLint** `eslint-plugin-jsx-a11y` (config `recommended`) pre `frontend/**/*.tsx`, beží v `pnpm lint` a teda aj v `pnpm verify`. Vidí iba natívne JSX elementy (`img`, `a`, `div` s `onClick`, `autoFocus` …), Mantine komponenty (`Button`, `ActionIcon`, `Modal`) nekontroluje. Posledná verzia pluginu (6.10.2) deklaruje ako peer ESLint najviac 9; s ESLint 10 pravidlá fungujú, `pnpm install` iba vypíše varovanie o peer závislosti.
- **axe** (`@axe-core/playwright`) v E2E teste `e2e/tests/accessibility.spec.ts` skenuje vyrenderované obrazovky v svetlej aj tmavej schéme, viď [Testovanie](./testing.md#prístupnosť-axe).

Pravidlá v kóde:

- `document.title` je „{{page}} – Locale“ (kľúč `documentTitle`). Nastavuje ho `PageIntro` z nadpisu stránky cez hook `hooks/useDocumentTitle.ts`, takže sa mení s navigáciou aj s jazykom UI. Prázdna domovská stránka má vizuálne skrytý `h1` **Domov** (`homePage.title`) a rovnaký titulok.
- Notifikácie renderuje `AppNotifications` (`main.tsx`): Mantine `Notifications` s preloženým prístupným menom krížika (`notification.close`, Mantine ho bez `closeButtonProps` nemá). Notifikácia aj `Alert` majú `role="alert"`.
- Chyba z API pri poli (`400` `details`, `409 EMAIL_TAKEN`, `409 LANGUAGE_TAKEN`) presunie fokus na prvé chybné pole (`setError(..., { shouldFocus: true })`, v **Pridať jazyk** na select), aby čítačka prečítala chybu. Chyby z klientskej validácie fokusuje React Hook Form sám (`shouldFocusError`).
- Po úspešnom **Skúsiť znova** v tabuľke používateľov alebo jazykov dostane fokus tabuľka (`tabIndex={-1}`), lebo tlačidlo nahradia riadky. Na stránke Môj profil dostane fokus pole **Meno** (`ProfileForm` s `focusFirstField`).
- Theme má `respectReducedMotion: true`, pri `prefers-reduced-motion` Mantine vypne prechody.

Čo automatické kontroly nezachytia (poradie fokusu, návrat fokusu po modáli, zrozumiteľnosť textov, oznamovanie stavov), kontroluje `accessibility-reviewer` ručne podľa svojho checklistu.

## Inšpirácia

Štruktúra a štýl kódu vychádzajú z FE projektu Notino Landing (atoms, components, pages, Mantine theme, query keys, SVGR ikony). Nové repo na ňom nie je závislé.
