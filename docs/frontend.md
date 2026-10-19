---
title: 'Frontend'
updated: 2026-10-19
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

| Priečinok     | Obsah                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `atoms/`      | malé obaly nad Mantine (`ButtonLink`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `components/` | zložené komponenty (`AppLayout`, `HomeLayout`, `Sidebar`, `TopBar`, `UserMenu`, `LanguageSwitcher`, `ThemeSwitcher`, `Brand`, `CenteredLayout`, `PageIntro`, `RouteError`, `RowAction` (ikona akcie v riadku tabuľky s tooltipom), `UsersTable`, `CreateUserModal`, projekty (`ProjectsList`, `CreateProjectModal`, `LeaveProjectModal`), členovia (`MembersTable`, `CreateMemberModal`), komponenty jazykov projektu (`LanguagesTable`, `LanguageFlag`, `AddLanguageModal`, `ConfirmDeleteModal`, spoločný rám modálu `AppModal`), komponenty profilu (`ProfileForm`, `ProfileCard`, `ProfileSection`, `PersonalDetailsSection`, `PreferencesSection`, `SecuritySection`), komponenty nastavení projektu (`ProjectSettingsForm`, `ProjectBasicsSection`, `VariableProtectionSection`), komponenty prekladov (`TranslationStats`, `TranslationsToolbar`, `TranslationsTable`, `TranslationText`, `TranslationEditor`, `TranslationsPagination`), komponenty importu (`ImportModal`, `ImportDropzone`, `ImportIssueList`, `ImportReviewTable`), `Icons/`, `Flags/`) |
| `pages/`      | obrazovky rout (`ProjectsPage`, `LoginPage`, `UsersPage`, `TranslationsPage`, `ProjectLanguagesPage`, `ProfilePage`, `ProjectSettingsPage`, `MembersPage`, `ForbiddenPage`, `NotFoundPage`, `ProjectNotFoundPage`, `ErrorPage`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `routes/`     | strom rout, guardy a router (`createAppRouter`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `api/`        | axios inštancia `http`, `queryClient`, `QUERY_KEYS`, auth hooky (`api/auth/`), hooky správy používateľov (`api/adminUsers/`), hooky profilu (`api/profile/`), hooky jazykov (`api/languages/`), hooky nastavení projektu (`api/projectSettings/`), hooky prekladov (`api/translations/`), hooky importu (`api/imports/`), 401 interceptor, `getApiErrorCode`, `getApiErrorDetails`, `getImportFileIssues`, `getPlaceholderMismatch`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `lib/`        | `constants.ts`, `enum.ts`, nastavenie i18n, `ForbiddenError`, `formatDate`, `formatRelativeTime`, `formatFileSize`, `importIssues` (preklad chýb importu), `utils.ts` (`isLanguage`, `isLightColor`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `locales/`    | preklady `sk.json`, `cs.json`, `en.json`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `styles/`     | Mantine theme, globálne CSS s poradím vrstiev, prekrytia Mantine komponentov                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `assets/`     | `icons/` (zdrojové SVG z Figmy), `flags/` (kruhové vlajky circle-flags s licenciou)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `types/`      | typy iba pre FE (typované i18n kľúče)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `test/`       | `setup.ts`, `renderApp` a `mockApi` pre unit testy                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

Priečinok komponentu obsahuje `Component.tsx`, `types.ts` (props) a voliteľne `Component.module.css`. Komponenty sa exportujú ako default a importujú plnou cestou (`@/components/Brand/Brand`). Barrel súbor je iba `components/Icons/index.ts` (`components/Flags/` barrel nemá, `LanguageFlag` importuje vlajky plnou cestou).

## Routing

TanStack Router s routami v kóde (ADR 0002), jeden súbor na routu v `routes/`. Root route má kontext s `queryClient`.

| Cesta                                 | Route                                         | Stránka                                             | Prístup                                  |
| ------------------------------------- | --------------------------------------------- | --------------------------------------------------- | ---------------------------------------- |
| `/login`                              | `loginRoute`                                  | `LoginPage`                                         | iba neprihlásený (prihlásený ide na `/`) |
| `/`                                   | `indexRoute` pod `_home`                      | `ProjectsPage` (zoznam projektov, bez sidebaru)     | prihlásený                               |
| `/profile`                            | `profileRoute` pod `_app`                     | `ProfilePage` (Môj profil)                          | prihlásený (`ADMIN` aj `EDITOR`)         |
| `/admin/users`                        | `adminUsersRoute` pod `_app`                  | `UsersPage` (zoznam a vytvorenie adminov)           | `ADMIN`, ostatní vidia `ForbiddenPage`   |
| `/projects/$projectSlug`              | `projectIndexRoute` pod `projectRoute`        | presmeruje na `/projects/$projectSlug/translations` | člen projektu alebo `ADMIN`              |
| `/projects/$projectSlug/translations` | `projectTranslationsRoute` pod `projectRoute` | `TranslationsPage` (Preklady), filtre v URL         | člen projektu alebo `ADMIN`              |
| `/projects/$projectSlug/settings`     | `projectSettingsRoute` pod `projectRoute`     | `ProjectSettingsPage` (Nastavenia projektu)         | člen projektu alebo `ADMIN`              |
| `/projects/$projectSlug/languages`    | `projectLanguagesRoute` pod `projectRoute`    | `ProjectLanguagesPage` (Jazyky projektu)            | člen projektu alebo `ADMIN`              |
| `/projects/$projectSlug/members`      | `projectMembersRoute` pod `projectRoute`      | `MembersPage` (Členovia)                            | člen projektu alebo `ADMIN`              |
| neexistujúca                          | root                                          | `NotFoundPage` (`notFoundComponent` root route)     | všetci                                   |

Strom: `_authenticated` (načíta používateľa, bez komponentu) → `_home` (`HomeLayout`, iba `/`) a `_app` (`AppLayout` so sidebarom, ostatné stránky). `projectRoute` (`/projects/$projectSlug`) je pod `_app`.

Chyba v `beforeLoad` alebo v komponente routy bez vlastného `errorComponent` zobrazí `ErrorPage` (`defaultErrorComponent` routera).

### Lazy routy (code splitting)

Komponenty stránok `/login`, `/profile`, `/admin/users`, prekladov, nastavení, jazykov a členov projektu sa načítajú až pri prvej návšteve routy. Route súbor (`loginRoute.ts`, `adminUsersRoute.ts`) drží iba kritickú časť (`path`, `beforeLoad` guard, pri `/admin/users` aj `errorComponent`, aby sa 403 zobrazila bez čakania na chunk stránky) a cez `.lazy(() => import('@/routes/<route>.lazy').then((module) => module.Route))` pripojí súbor `<route>.lazy.ts`, ktorý obsahuje `createLazyRoute('<route id>')({ component })`. Route id je cesta vrátane pathless rodičov (`/_authenticated/_app/admin/users`), typecheck preklep v id zachytí. `ProjectsPage` (prvá stránka po prihlásení) a stránky 404, 403 a chybová stránka ostávajú v hlavnom chunku.

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

Po pridaní stránky Preklady (2026-10-18): lazy chunk stránky má 13,1 kB / 4,2 kB a vlastné CSS 4,1 kB / 1,2 kB. `index` má 113 kB / 36 kB, `mantine` 320 kB / 96 kB (pribudol `Progress`), `i18n-zod` 132 kB / 39 kB. `zod` je teraz aj priama závislosť frontendu (rovnaká verzia ako v `@locale/shared`), lebo eager route `projectTranslationsRoute` definuje schému search params; v chunku `i18n-zod` bol už predtým cez `@locale/shared`. Žiadny chunk nie je nad 500 kB.

### Guardy

- `_authenticated` je pathless route (bez segmentu v URL) bez vlastného komponentu; layout dodávajú jej deti `_home` (`HomeLayout`) a `_app` (`AppLayout`). Jej `beforeLoad` zavolá `queryClient.ensureQueryData(meQueryOptions)`. Pri 401 presmeruje na `/login` (bez `?redirect=`), iné chyby (5xx, nedostupný backend) pustí ďalej a zobrazí sa `ErrorPage`. Načítaného používateľa vráti do kontextu ako `context.user` pre podriadené routy.
- `/login`: `beforeLoad` skúsi načítať `me`. Ak sa podarí, presmeruje na `/`. Akákoľvek chyba (401, nedostupný backend) znamená, že sa zobrazí formulár.
- `/projects/$projectSlug`: URL obsahuje slug projektu, API ostáva na id. `loader` nájde id podľa slugu v zozname projektov (`ensureQueryData(projectsQueryOptions)`, zoznam obsahuje práve projekty, ktoré používateľ smie otvoriť). Ak slug v uloženom zozname nie je (projekt vytvorený alebo premenovaný po načítaní zoznamu), načíta zoznam raz nanovo (`fetchQuery` so `staleTime: 0`). Potom zavolá `ensureQueryData(projectSettingsQueryOptions(projectId))` bez opakovaní a vráti `{ projectId }` (stránky ho čítajú cez `useLoaderData`, sidebar cez `useMatch`). Neznámy slug alebo `404 NOT_FOUND` (projekt neexistuje alebo používateľ nie je členom) vyhodí `notFound()` a vnútri `AppLayout` sa zobrazí `ProjectNotFoundPage` („Projekt sa nenašiel“, **Späť na projekty**). Iná chyba zobrazí `ErrorPage` cez `RouteError`. Rolu neoveruje, prístup rozhoduje BE.
- `/admin/users`: `beforeLoad` pre rolu inú ako `ADMIN` vyhodí `ForbiddenError`. `errorComponent` (`RouteError`) pre túto chybu zobrazí `ForbiddenPage` vnútri layoutu a URL ostáva rovnaká. Iné chyby zobrazí `ErrorPage` vnútri layoutu.
- Po prihlásení ide `ADMIN` aj `EDITOR` na `/`.

Produkčný server (nginx) musí pre neznáme cesty vrátiť `index.html` (SPA fallback), inak refresh na hlbokej route skončí chybou servera.

## API

- Jediná axios inštancia `api/http.ts`: `baseURL: '/api'`, `withCredentials: true`.
- Interceptor posiela pri každej požiadavke `X-Requested-With: XMLHttpRequest`. Mutácie (`POST`, `PUT`, `PATCH`, `DELETE`) bez tela pošlú `{}`, aby odišla hlavička `Content-Type: application/json` (ochrana proti CSRF na BE).
- Query kľúče sú iba v `QUERY_KEYS` (`api/queryKeys.ts`).
- `getApiErrorCode(error)` vráti `ERROR_CODE` z odpovede podľa `errorResponseSchema` z `@locale/shared`, inak `UNKNOWN`. Text chyby sa zobrazuje iba cez preklad `errors.<CODE>`, nikdy z `message`. `getApiErrorDetails(error)` vráti `details` z `VALIDATION_ERROR` (inak prázdne pole), `getImportFileIssues(error)` vráti `{ issues, total }` z `422 IMPORT_FILE_INVALID` (inak `null`), `getPlaceholderMismatch(error)` vráti `{ missing, extra }` z `400 PLACEHOLDER_MISMATCH` (inak `null`).
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

### Jazyky projektu

| Hook                                                       | Čo robí                                                                                                                                                                 |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `projectLanguagesQueryOptions`, `useProjectLanguagesQuery` | `GET /api/projects/:id/languages` (`LanguagesResponse`, základný jazyk prvý), kľúč `QUERY_KEYS.PROJECTS.LANGUAGES(id)`                                                  |
| `useCreateProjectLanguageMutation`                         | `POST /api/projects/:id/languages`; po úspechu invaliduje celý `PROJECTS.DETAIL(id)` (prvý jazyk sa stane základným aj v nastaveniach), pri `409 LANGUAGE_TAKEN` jazyky |
| `useDeleteProjectLanguageMutation`                         | `DELETE /api/projects/:id/languages/:languageId`; pri `404 NOT_FOUND` a `409 LANGUAGE_IS_BASE` tiež invalidácia                                                         |

Katalóg pre selecty (Pridať jazyk, jazyky v Novom projekte) je priamo `SUPPORTED_LANGUAGES` zo `@locale/shared`, bez API. Položky a vlajky v nich skladá `lib/languageOptions.tsx` (`getLanguageOptions`, `renderLanguageOption`).

### Projekty a členovia

Kľúče sú pod `QUERY_KEYS.PROJECTS`: `LIST()`, `DETAIL(projectId)` (prefix všetkých dotazov projektu), `SETTINGS(projectId)` a `MEMBERS(projectId)`.

| Hook                                                     | Čo robí                                                                                                                                                        |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `projectsQueryOptions`, `useProjectsQuery`               | `GET /api/projects` (`ProjectListResponse`), kľúč `PROJECTS.LIST()`                                                                                            |
| `useCreateProjectMutation`                               | `POST /api/projects`, po úspechu invaliduje `PROJECTS.LIST()`                                                                                                  |
| `useLeaveProjectMutation`                                | `DELETE /api/projects/:id/membership`, po úspechu odstráni z cache `PROJECTS.DETAIL(id)` (člen už k projektu nemá prístup) a invaliduje `PROJECTS.LIST()`      |
| `projectSettingsQueryOptions`, `useProjectSettingsQuery` | `GET /api/projects/:id/settings` (`ProjectSettings`), kľúč `PROJECTS.SETTINGS(id)`                                                                             |
| `useUpdateProjectSettingsMutation`                       | `PATCH /api/projects/:id/settings`, po úspechu invaliduje `PROJECTS.SETTINGS(id)`, `PROJECTS.LIST()` (názov a farba v zozname) aj `LANGUAGES` a čaká na všetky |
| `projectMembersQueryOptions`, `useProjectMembersQuery`   | `GET /api/projects/:id/members`, kľúč `PROJECTS.MEMBERS(id)`                                                                                                   |
| `useCreateProjectMemberMutation`                         | `POST /api/projects/:id/members`, po úspechu invaliduje `PROJECTS.MEMBERS(id)`                                                                                 |

`LANGUAGES` sa invaliduje, lebo zmena základného jazyka mení odznak Základný na stránke Jazyky.

### Preklady a import

Kľúče: `PROJECTS.TRANSLATIONS(projectId, query)` pre jednu stránku zoznamu a prefix `PROJECTS.TRANSLATIONS_ALL(projectId)` pre všetky stránky projektu.

| Hook                                               | Čo robí                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `translationsQueryOptions`, `useTranslationsQuery` | `GET /api/projects/:id/translations` s parametrami `TranslationsQueryInput` (`params` axios), odpoveď `TranslationsResponse`, kľúč `QUERY_KEYS.PROJECTS.TRANSLATIONS(id, query)`. Kým nie sú známe jazyky, je vypnutý (`query` `null`). `placeholderData: keepPreviousData`, takže pri zmene filtra alebo strany ostane predošlá strana a tabuľka nebliká skeletonmi                                                                                                                                                            |
| `useUpdateTranslationMutation(id, listQuery)`      | `PUT /api/projects/:id/keys/:keyId/translations/:languageId` s telom `{ value }` (`UpdateTranslationRequestInput`), odpoveď `UpdateTranslationResponse`. Optimisticky prepíše položku v cache stránky `listQuery` (hodnota, stav, `updatedAt`) a `stats.translated/untranslated`, keď sa stav zmení; pri chybe vráti snímku; po skončení (úspech aj chyba) invaliduje všetky stránky prekladov projektu (`QUERY_KEYS.PROJECTS.TRANSLATIONS_ALL(id)`), čo opraví aj návrat snímky, ktorý by prepísal súbežnú úpravu iného riadku |
| `useImportPreviewMutation(id)`                     | `POST /api/projects/:id/imports/preview` (`ImportPreviewRequest` → `ImportPreviewResponse`), nič neinvaliduje (preview nezapisuje)                                                                                                                                                                                                                                                                                                                                                                                              |
| `useImportMutation(id)`                            | `POST /api/projects/:id/imports` (`ImportRequestInput` → `ImportResult`); po úspechu invaliduje všetky dotazy projektu (`PROJECTS.DETAIL(id)`: preklady, štatistiky aj jazyky)                                                                                                                                                                                                                                                                                                                                                  |

### Profil

| Hook                                     | Čo robí                                                                                                                                                                                             |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profileQueryOptions`, `useProfileQuery` | `GET /api/profile` (`Profile`), kľúč `QUERY_KEYS.PROFILE()`, globálny `retry`                                                                                                                       |
| `useUpdateProfileMutation`               | `PATCH /api/profile` (`UpdateProfileRequest` → `Profile`). Po úspechu `setQueryData` pre `PROFILE` aj `AUTH.ME` (polia `AuthUser`), iniciály a meno v sidebari sa zmenia hneď bez ďalšieho requestu |

## Layout, sidebar a horná lišta

Zoznam projektov (`/`) má `HomeLayout`: iba horná lišta s logom vľavo a `UserMenu` vpravo, bez sidebaru, lebo ešte nie je vybraný projekt. Ostatné prihlásené stránky majú `AppLayout` postavený na Mantine `AppShell` s `layout="alt"`: sidebar je fixný vľavo na celú výšku okna, horná lišta (64 px) a obsah sú vpravo od neho. Obsah routy je v `AppShell.Main` (`<main>`) a scrolluje celá stránka, sidebar a lišta ostávajú na mieste. Drobčeky a ikona `?` z Figmy zatiaľ nie sú.

**Úzke obrazovky (pod `md`, 62em):** sidebar je skrytý mimo obrazovky a otvára sa tlačidlom `Burger` vľavo v hornej lište (**Otvoriť navigáciu**, `aria-expanded`, `aria-controls` na sidebar). Otvorený sidebar má celú šírku obrazovky a vlastný `Burger` (**Zavrieť navigáciu**). Zatvorí sa aj po kliknutí na položku navigácie alebo **Môj profil**. Zatvorený sidebar má okrem posunu Mantine aj `visibility: hidden` (`data-collapsed`), aby jeho odkazy neboli v poradí tabulátora. Pri zatvorení sa fokus presunie na **Otvoriť navigáciu** v hornej lište, inak by ostal na skrytom prvku sidebaru.

### Sidebar

`Sidebar` podľa Figmy `3:1656` (v kontexte obrazovky `3:812`), iba so stránkami, ktoré existujú:

- šírka 236 px vrátane pravého okraja `--app-color-border` s 80 % krytím, padding 16 px, pozadie `--app-color-surface`. Element je `<aside>` (`AppShell.Navbar` s `component="aside"`).
- hore `Brand` (logo „Locale / WORKSPACE“) ako odkaz `Link` na `/` s prístupným menom „Locale – domovská stránka“. Vzhľad loga sa nemení (bez podčiarknutia a zmeny farby), pri fokuse z klávesnice má obrys. Na úzkej obrazovke klik na logo zavrie otvorený sidebar ako položky navigácie. `Brand` v `CenteredLayout` (login, chybové stránky) odkazom nie je.
- v projekte pod logom (odsadený 28 px) prepínač projektu `ProjectSwitcher` podľa Figmy `3:470`: karta (padding 10 px, okraj `--app-color-border`, radius `lg`, tieň `xs`, výška aspoň 62 px), štvorček 32 px s iniciálami v primárnej farbe projektu (radius `sm`, text čierny alebo biely podľa `isLightColor`), názov 12 / 16 / 600 `--app-color-text-strong` a pod ním slug 10 / 15 `--app-color-muted` (Figma má „Organizácia1“, organizácie nie sú), vpravo šípka `ChevronSelector` 15 px. Prístupné meno „Prepnúť projekt, aktuálny {{name}}“. Otvára Mantine `Menu` na šírku karty: nadpis Projekty, projekty zo `useProjectsQuery` (malý štvorček s iniciálami, aktuálny má `aria-current` a pozadie `--app-color-brand-tint`) a **Všetky projekty**. Výber projektu ostane na tej istej stránke (Preklady, Jazyky alebo Členovia), z Nastavení projektu otvorí Preklady, a zavrie sidebar na úzkej obrazovke. Údaje projektu berie z cache `PROJECTS.SETTINGS`, sidebar sám nastavenia nenačítava.
- `<nav aria-label="Hlavná navigácia">` (odsadená 24 px od loga alebo prepínača):
    - Mimo projektu **Všetky projekty** (`/`, ikona `ArrowRight` otočená doľava).
    - V projekte (`/projects/$projectSlug/*`): zoznam **Preklady** (`translations`, ikona `Translate`, prvá položka), **Nastavenia projektu** (`settings`, ikona `Settings`), **Jazyky** (`languages`, ikona `Globe`) a **Členovia** (`members`, ikona `Users`) s prístupným menom názvu projektu. **Všetky projekty** tu nie je, je v prepínači projektu.
    - Iba `ADMIN`: oddeľovač (`--app-color-border-subtle`, okraje 16 px), nadpis sekcie **SPRÁVA** (10 / 15 / 700, veľké písmená, rozostup 0,14 em, `--app-color-muted`) a **Používatelia** (`/admin/users`, ikona `Users`).
    - Zoznamy sekcií majú `aria-labelledby` na nadpis sekcie.
- položka: odkaz TanStack Router `Link`, výška aspoň 44 px, padding 10 / 12 px, medzera 12 px, radius `lg`, text 16 / 24 `--mantine-color-text`, ikona 18 px `--app-color-muted`, medzi položkami 4 px. Hover `--app-color-surface-muted` (vo Figme nie je). Dlhý text sa neskracuje, zalomí sa na ďalší riadok a položka sa zvýši (**Nastavenia projektu** má v sidebari 236 px dva riadky a výšku 68 px ako Figma `3:1724`, na úzkej obrazovke jeden riadok). Ikona a bodka sú zvisle v strede položky.
- aktívna položka podľa aktuálnej routy: `Link` jej sám nastaví `aria-current="page"` a `data-status="active"`. Pozadie `--app-color-brand-tint`, text `--app-color-eyebrow`, ikona a bodka 6 px vpravo `brand.6`.
- dole `UserMenu`

Vynechané, lebo ešte neexistujú: Prehľad, Aktivita a box Chránené premenné.

### Používateľ v sidebari (`UserMenu`)

Blok podľa Figmy `3:1742`: padding 8 px, medzera 12 px, avatar 32 px (`--app-color-avatar`, iniciály 10 px / 700 biele cez `getInitials`, `aria-hidden`), meno 12 / 16 / 600 `--app-color-text-strong` (bez mena email, dlhý text sa skráti), pod ním globálna rola 10 / 15 `--app-color-muted` (`Administrátor` / `Člen`, kľúče `roles.<ROLE>`, rovnaké ako v karte profilu). Vpravo tlačidlo `⋯` (`ActionIcon` 32 px, ikona `DotsHorizontal`, `--app-color-muted`) s prístupným menom **Menu používateľa**. Klikateľné je iba `⋯`, nie celý riadok (prístupné meno celého riadku by sa líšilo od viditeľného mena).

V hornej lište zoznamu projektov je ten istý blok s `placement="header"` (bez horného okraja, najviac 240 px). Tlačidlo otvára Mantine `Menu` (v sidebari nad tlačidlom, v lište pod ním, 240 px): email, **Môj profil** (všetky role, odkaz na `/profile`) a **Odhlásiť sa**. Chyba pri odhlásení sa ukáže ako notifikácia `errors.<CODE>`. Odkazy Používatelia a Jazyky sú v navigácii sidebaru, nie v menu.

### Horná lišta

`TopBar` je `AppShell.Header` podľa Figmy `3:817` bez drobčekov a ikony `?`: výška 64 px, pozadie `--app-color-surface` s 90 % krytím a `backdrop-filter: blur(8px)`, spodný okraj `--app-color-border` s 80 % krytím, vodorovný padding 32 px. Logo a menu používateľa sú v sidebari; v `HomeLayout` ich lišta dostane cez `start` a `end`.

- vľavo `Burger` (iba pod `md` a iba keď je sidebar), v `HomeLayout` logo
- vpravo:
    - `LanguageSwitcher`: Mantine `Select` (prístupné meno **Jazyk**, šírka 160 px, výška 38 px ako prepínač schémy, radius `md`) so Slovenčinou, Češtinou a English. Názvy sú v danom jazyku vo všetkých jazykoch UI (kľúče `topBar.languages.<jazyk>.name`, možnosť má `lang`). Volá `i18n.changeLanguage`, jazyk sa zmení bez reloadu a uloží do `localStorage['locale']`. Vľavo v poli je vlajka aktuálneho jazyka, v zozname vlajka pred každým názvom (viď i18n). Zoznam nemá `ScrollArea` (`withScrollArea={false}`), pri troch možnostiach netreba a v jsdom predlžovala prvý render každej stránky asi o 0,5 s.
    - `ThemeSwitcher`: prepínač svetlej a tmavej schémy (viď Farebné schémy), hneď za prepínačom jazyka.

## Prihlasovacia stránka

Podľa Figmy `5:2861`: `CenteredLayout`, `PageIntro` (Prihlásenie / Vitajte späť / popis), polia E-mail a Heslo, tlačidlo **Prihlásiť sa** so šípkou.

- React Hook Form + `zodResolver(loginRequestSchema)` zo `@locale/shared`. Chybové hlášky zodu sa cez `toValidationCode` prekladajú na `validation.<CODE>` (s `{{min}}` / `{{max}}`).
- Odpoveď `VALIDATION_ERROR` s `details` sa priradí k poliam (`setError`). Ostatné chyby sa zobrazia nad tlačidlom (Mantine `Alert`) ako `errors.<CODE>`. Pri 429 sa zobrazí `loginPage.form.rateLimited` so sekundami z hlavičky `Retry-After`, ak hlavička chýba, tak `errors.RATE_LIMITED`.
- Počas odosielania je tlačidlo v stave `loading` (zároveň `disabled`), formulár sa nedá odoslať dvakrát.
- Heslo je obyčajný `TextInput type="password"` bez prepínača viditeľnosti (Figma ho nemá).

## Stránka Používatelia

Podľa Figmy `28:2` bez drobčekov, vnútri `AppLayout` na route `/admin/users` (iba `ADMIN`, položka **Používatelia** v sekcii SPRÁVA sidebaru). Stránka zobrazuje a vytvára iba administrátorov; členov projektov vytvára stránka Členovia. Riadok iného admina má ikonu koša (`RowAction`, tooltip **Odstrániť**, prístupné meno **Odstrániť administrátora {{email}}**), ktorá po potvrdení v `DeleteAdminModal` účet odstráni; vlastný riadok tlačidlo nemá. Obsah má šírku najviac 1200 px a padding 32 px.

- Hlavička: `PageIntro` s `titleSize="h2"` (malý ružový nadpis „Správa“, H1 „Používatelia“ vo veľkosti 28 px, popis) a vpravo dole primárne tlačidlo **Vytvoriť administrátora** s ikonou `Plus`, ktoré otvorí modál.
- `UsersTable`: Mantine `Table` v karte (biela, okraj `slate.2`, radius `xl`). Hlavička tabuľky na pozadí `slate.0`, texty 10 px / 700 veľkými písmenami `slate.4`. Stĺpce **E-mail** (avatar 32 px s iniciálami z emailu cez `getInitials({ email, firstName: null, lastName: null })`, pozadie `slate.1`, text `slate.6`, `aria-hidden`, lebo vedľa je celý email) a **Vytvorený** (šírka 180 px, dátum cez `formatDate`). Riadky oddeľuje okraj `slate.1`. Poradie je z API (najnovší hore).
- Stavy, ktoré nie sú vo Figme: načítavanie (3 riadky Mantine `Skeleton`, tabuľka má `aria-busy`), prázdny zoznam (text v tabuľke) a chyba (text „Zoznam administrátorov sa nepodarilo načítať.“, preklad `errors.<CODE>` a tlačidlo **Skúsiť znova**, ktoré zavolá `refetch`).

### Formátovanie dátumu

`lib/formatDate.ts`: `formatDate(isoDate, language)` cez `Intl.DateTimeFormat` s číselným dňom, mesiacom a rokom, bez dátumovej knižnice. Jazyk UI `sk` → `sk-SK` (`12. 10. 2026`, `3. 10. 2026`), `en` → `en-GB` (`12/10/2026`, `03/10/2026`). Neznámy jazyk použije `sk`. Tabuľka berie `i18n.language`, takže zmena jazyka preformátuje dátumy bez reloadu.

### Modál Nový administrátor

`CreateUserModal` podľa Figmy `28:191`, zložený z `Modal.Root` a podkomponentov (nadpis a popis v hlavičke, vlastná ikona `Close`):

- šírka 560 px, radius `xl`, biele pozadie obsahu aj hlavičky, okraj `slate.2`, tieň `shadows.modal`, overlay `theme.black` s 25 % krytím a rozmazaním 2 px
- hlavička: nadpis „Nový administrátor“ 18 / 28 / 700 `slate.9`, popis 14 px, zatváracie tlačidlo 34 px s ikonou `slate.4`, spodný okraj `slate.1`
- polia **E-mail** (placeholder `meno@firma.sk`) a **Heslo** (`TextInput type="password"`, placeholder `Min. {{min}} znakov` s `PASSWORD_MIN_LENGTH`; Figma má „Min. 6“, platí konštanta)
- päta s pozadím `slate.0` (60 %): **Zrušiť** (`variant="default"`) a **Vytvoriť administrátora**

Správanie:

- React Hook Form + `zodResolver(createUserRequestSchema)` zo `@locale/shared`, chyby zodu cez `toValidationCode` → `validation.<CODE>` (s `{{min}}` / `{{max}}`). Odoslaný email je normalizovaný (trim, malé písmená).
- `400 VALIDATION_ERROR` s `details` → `setError` pri poliach. `409 EMAIL_TAKEN` → `errors.EMAIL_TAKEN` pri poli E-mail. Iné chyby → červená Mantine notifikácia `errors.<CODE>`, modál ostáva otvorený.
- Počas odosielania je tlačidlo v stave `loading` (aj `disabled`) a `onSubmit` počas bežiacej mutácie nič neurobí, formulár sa nedá odoslať dvakrát.
- Počas odosielania sa modál nedá zavrieť: **Zrušiť** a krížik sú `disabled`, `Esc` a klik mimo modálu sú vypnuté (`closeOnEscape`, `closeOnClickOutside`). Inak by zatvorenie resetovalo mutáciu a stratila by sa notifikácia o úspechu alebo chybe.
- Po úspechu: invalidácia zoznamu, zelená notifikácia „Používateľ {{email}} bol vytvorený.“, reset formulára a zatvorenie modálu. **Zrušiť**, krížik, `Esc` aj klik mimo modálu formulár tiež resetujú.

## Stránka Preklady

`/projects/$projectSlug/translations` (`TranslationsPage`) podľa Figmy `3:2` vnútri `AppLayout`, pre členov projektu aj `ADMIN`. Projekt sa otvára na nej (`/projects/$projectSlug` presmeruje sem). Obsah má šírku najviac 1440 px a padding 32 px. Kapitola pokrýva míľniky A, D a E plánu `docs/plans/translations-import.md`: zoznam s [filtrami v URL](#url-search-params), [úpravu prekladu v riadku](#úprava-prekladu-v-riadku) a [modál Importovať preklady](#modál-importovať-preklady). Hooky sú v [Preklady a import](#preklady-a-import), kontrakt v `packages/shared/src/translations.ts` a `imports.ts`, API v [preklady](./api/translations.md) a [import](./api/imports.md).

- Hlavička: `PageIntro` s `titleSize="h2"` a `eyebrowBadge` (názov projektu ako odznak: pozadie `--app-color-brand-tint`, text `--app-color-eyebrow`, radius 6 px, Figma `3:35`), nadpis **Preklady** a popis z Figmy. Vpravo **Importovať** (`Button variant="default"`, ikona `Upload`), otvorí [modál Importovať preklady](#modál-importovať-preklady).
- `TranslationStats`: tri karty pre vybraný cieľový jazyk zo `stats` odpovede (počítajú všetky kľúče projektu, filtre ich nemenia): **Celkom kľúčov** (ikona `Key`), **Preložené** (ikona `Check`, ružový `Progress` 4 px) a **Chýbajúce** (ikona `File` na `--mantine-color-yellow-light`, žltý `Progress`). Progress má prístupné meno „Preložené: 89 %“. Karta: okraj `--app-color-border` 80 %, radius `xl`, padding 16 px, číslo 24 / 32 / 700 `--app-color-title`. Počas načítania `Skeleton` namiesto čísla.
- `TranslationsToolbar` v hlavičke karty tabuľky: vyhľadávanie (`TextInput` s ikonou `Search`, kľúč aj text, zapíše sa do URL 300 ms po poslednom stlačení cez `useDebouncedCallback`), stav (**Všetky stavy** / **Nepreložené** / **Preložené**), namespace (`Select` s možnosťou zrušiť, placeholder **Všetky namespace**, iba ak má projekt viac ako jeden neprázdny namespace), zoradenie (**Nepreložené najprv** / **Podľa kľúča** / **Naposledy upravené**) a vpravo zdrojový → cieľový jazyk (`Select` s tagom veľkými písmenami, vlajkou vľavo a v zozname s pôvodným názvom). Jazyky sú z `useProjectLanguagesQuery`.
- `TranslationsTable` (**Zoznam prekladov**): stĺpce **Kľúč**, zdrojový jazyk a cieľový jazyk (hlavička = pôvodný názov jazyka veľkými písmenami), **Stav**.
    - Kľúč monospace 12 / 18 / 600 `--app-color-label`, pod ním skupina a relatívny čas `target.updatedAt` (`formatRelativeTime` so `style: 'short'`, napr. „pred 2 min“), oddelené bodkou 2 px.
    - Zdrojový text bez rámčeka a iba na čítanie, cieľový v rámčeku (`--app-color-border`, radius `sm`, padding 8 px) ako vo Figme; rámček je tlačidlo, ktoré otvorí [úpravu v riadku](#úprava-prekladu-v-riadku). Prázdna hodnota (`null`) ukáže tlmený text **Bez prekladu**.
    - `TranslationText`: `{{var}}` aj `{{ var }}` ako chip (`<code>`, monospace 11 px / 600, pozadie `--app-color-brand-tint`, text `--app-color-eyebrow`, okraj eyebrow 25 %). Ostatný text vrátane HTML je obyčajný text, React ho escapuje; `dangerouslySetInnerHTML` sa nepoužíva.
    - Stav: Mantine `Badge variant="light"` s bodkou, **Preložené** `teal`, **Nepreložené** `red`. Stĺpec má 10 rem s vodorovným paddingom 1 rem (ostatné bunky 1,75 rem), aby sa najdlhší text („Untranslated“, „Nepřeložené“) zmestil bez skrátenia; odznak sa nezmenšuje.
    - Riadok má `data-status="TRANSLATED|UNTRANSLATED"`, nepreložený má pozadie `--app-color-untranslated-bg`.
    - Hlavička skupiny: riadok `<th scope="rowgroup">` s `data-group-header` sa vloží vždy, keď sa `group` líši od predošlého riadku, aj na začiatku každej strany (pri predvolenom zoradení sú nepreložené prvé a vnútri zoskupené). Iba pri zoradení **Nepreložené najprv** a **Podľa kľúča** (backend radí `KEY` podľa namespace, skupiny a kľúča); pri **Naposledy upravené** by sa skupiny striedali, preto sa hlavičky nezobrazujú. Prázdna skupina sa ukáže ako **Bez skupiny**.
    - Tabuľka má `min-width` 56 rem a na úzkej obrazovke sa posúva vodorovne.
- `TranslationsPagination` pod kartou: „Zobrazených 50 z 248 kľúčov“ (i18next plurál `summary_one/few/many/other` podľa `total`) a pri viac ako jednej strane `<nav aria-label="Stránkovanie">` s **Predošlá**, číslami strán (`usePagination`, aktuálna `aria-current="page"`, prístupné meno „Strana 2“) a **Ďalšia**. 50 kľúčov na stranu (`TRANSLATIONS_PAGE_SIZE_DEFAULT`).
- Stavy: načítavanie (5 riadkov `Skeleton`, `aria-busy`, skeletony v kartách), projekt bez kľúčov alebo bez jazykov (text „Projekt zatiaľ nemá žiadne kľúče. Pridáte ich importom súboru.“ a **Importovať**, ktoré tiež otvorí modál importu; bez jazykov sa preklady nenačítavajú), nič nevyhovuje filtrom (text a **Zrušiť filtre**, ktoré zmaže vyhľadávanie, stav, namespace a stranu, zoradenie a jazyky ostanú), chyba jazykov alebo prekladov (text „Preklady sa nepodarilo načítať.“, `errors.<CODE>` a **Skúsiť znova**, po úspechu fokus na tabuľku; karty sa vtedy skryjú).

### URL search params

Filtre sú v URL (`validateSearch` zod schémou `translationsSearchSchema` v `routes/projectTranslationsRoute.ts`), prežijú reload a dajú sa zdieľať. Každý parameter je voliteľný, neplatná hodnota sa zahodí (`.catch(undefined)`) a použije sa predvolená. Predvolené hodnoty sa do URL nezapisujú.

| Parameter   | Hodnota                                | Predvolená                                              |
| ----------- | -------------------------------------- | ------------------------------------------------------- |
| `search`    | text, najviac 200 znakov               | bez vyhľadávania                                        |
| `status`    | `TRANSLATED`, `UNTRANSLATED`           | všetky stavy                                            |
| `namespace` | názov namespace                        | všetky                                                  |
| `sort`      | `UNTRANSLATED_FIRST`, `KEY`, `UPDATED` | `UNTRANSLATED_FIRST`                                    |
| `source`    | tag jazyka projektu (`sk`)             | základný jazyk                                          |
| `target`    | tag jazyka projektu (`en`)             | prvý jazyk iný ako zdrojový, pri jednom jazyku zdrojový |
| `page`      | číslo strany od 1                      | 1                                                       |

Jazyky sú v URL ako tagy (čitateľnejší odkaz ako UUID), stránka ich preloží na `sourceLanguageId` a `targetLanguageId` pre API. Tag, ktorý projekt nemá, sa ignoruje. Každá zmena filtra vráti stranu na 1 a nahradí položku histórie (`replace`). Ak je v URL aktívny filter `namespace`, select sa zobrazí, aj keď má projekt najviac jeden namespace, aby aktívny filter nebol neviditeľný. Strana za koncom (`?page=99` alebo posledná strana sa zmenšila) presmeruje na poslednú stranu namiesto stavu „nič nenájdené“. Vyhľadávanie má `maxLength` 200 (`TRANSLATIONS_SEARCH_MAX_LENGTH`). Namespace `""` (kľúče bez namespace) sa vo filtri neponúka, lebo API berie prázdny reťazec ako „bez filtra“.

Odchýlky od Figmy: chýba **Exportovať**, „Posledný sync“, karta a stav **Na kontrolu** a stav **Chýba** (stavy sú iba dva), drobčeky; pribudli filtre namespace a zoradenie a výber cieľového jazyka. Prázdny cieľ ukazuje „Bez prekladu“ namiesto „Pridať anglický preklad…“. Polia toolbaru majú výšku 44 px z theme (Figma 40 px). Relatívny čas je z `Intl` bez bodky („pred 2 min“, Figma „pred 2 min.“).

### Úprava prekladu v riadku

`TranslationEditor` (`components/TranslationEditor/`) je obsah bunky cieľového jazyka; úprava nemá Figmu, zdrojová bunka ostáva iba na čítanie.

- **Zobrazenie**: natívne `<button>` s hodnotou (premenné `{{…}}` ako chip cez `TranslationText`) alebo **Bez prekladu**. Prístupné meno je „Preklad kľúča orders.empty.title, English: Welcome back, {{name}}“ (skrytý prefix `VisuallyHidden` + viditeľná hodnota; jazyk je pôvodný názov cieľového jazyka). Klik, Enter alebo medzerník otvoria úpravu – bez vlastného spracovania klávesov, stačí natívne tlačidlo.
- **Úprava**: Mantine `Textarea` s `autosize` (1 – 8 riadkov), `maxLength` `TRANSLATION_VALUE_MAX_LENGTH` (10 000), obyčajný text (chipy iba v zobrazení – rozhodnutie plánu), kurzor na konci. Prístupné meno „Preklad kľúča orders.empty.title, English“, pod poľom hint „Uložiť: Ctrl+Enter alebo klik mimo pole. Zrušiť: Esc.“ (`description` cez `aria-describedby`). Pole má písmo bunky (16 px / 400), nie 12 px / 600 z theme toolbaru (`.root .input` v CSS module prebije `Input.extend`).
- **Uloženie**: blur (klik mimo pole, Tab) alebo `Ctrl/Cmd+Enter`. Prázdny alebo iba biely text pošle `null` (stav **Nepreložené**). Rovnaká hodnota ako predtým nepošle nič. Počas requestu ostáva pole otvorené, `readOnly` a vpravo má malý `Loader` (`role="status"`, „Ukladá sa“); odznak stavu, červené pozadie riadku aj karty sa menia hneď (optimisticky, `useUpdateTranslationMutation`). Po úspechu sa pole zavrie; ak v ňom bol ešte fokus (Ctrl+Enter), vráti sa na tlačidlo bunky, po blur ostáva tam, kam používateľ prešiel.
- **Esc** zavrie pole bez requestu, vráti pôvodnú hodnotu a fokus na tlačidlo. Obyčajný Enter vloží nový riadok.
- **`400 PLACEHOLDER_MISMATCH`** (zapnutá ochrana premenných, premenné sa líšia od základného jazyka): pole ostáva otvorené s rozpísanou hodnotou a pod ním `role="alert"` „Premenné v preklade sa nezhodujú so základným jazykom. Chýbajú: {{name}}. Navyše: {{user}}.“ (`errors.PLACEHOLDER_MISMATCH` + `translationsPage.editor.missing/extra` z `details.missing/extra`, helper `api/getPlaceholderMismatch.ts`); zoznam sa vráti na pôvodnú hodnotu. Oprava a ďalší blur alebo Ctrl+Enter skúsi uložiť znova (chybová hláška ostáva, kým neodpovie ďalší request); blur bez zmeny po tejto chybe (text je rovnaký ako odmietnutý) úpravu zahodí bez requestu (inak by sa tá istá chybná požiadavka opakovala), Esc tiež.
- **Iná chyba** (`404 TRANSLATION_KEY_NOT_FOUND`, `500` …): červená notifikácia `errors.<CODE>`, pole sa zavrie, zoznam aj karty sa vrátia na pôvodnú hodnotu.
- **Tab**: v riadku nie je iné fokusovateľné prvky (kľúč, zdroj ani odznak stavu), takže Tab z tlačidla alebo z otvoreného poľa ide rovno na bunku cieľa ďalšieho riadku; Tab z poľa zároveň blurom uloží zmenu.

### Modál Importovať preklady

`ImportModal` (`components/ImportModal/`), otvára ho **Importovať** v hlavičke stránky Preklady aj v prázdnom stave tabuľky. Rám je `AppModal` so `size="xl"` (780 px), na obrazovke do 48 em (`useMediaQuery`) na celú obrazovku (`fullScreen`). Počas requestu (preview, pridanie jazyka, import) sa modál nedá zavrieť. Zatvorenie (krížik, **Zrušiť**, Esc, klik mimo) aj úspešný import vrátia modál do kroku 1 s prázdnym súborom a zapnutým checkboxom. Nad obsahom je indikátor kroku („Krok 1 z 2 · Nahratie“ / „Krok 2 z 2 · Kontrola“) ako nadpis `h3` s `tabIndex={-1}`; pri zmene kroku naň prejde fokus (`useDidUpdate`), lebo tlačidlo, ktoré krok zmenilo, je medzitým disabled alebo nahradené a fokus by spadol na `body`. Hooky `useImportPreviewMutation` a `useImportMutation` sú v tabuľke [Preklady a import](#preklady-a-import).

**Krok 1 – Nahratie** (Figma `3:2042`):

- `ImportDropzone`: vlastná dropzone bez `@mantine/dropzone`. Celá plocha je `<label>` s natívnym `<input type="file" accept=".csv,text/csv">` (vizuálne skrytý, ostáva v poradí tabulátora, prístupné meno **Súbor s prekladmi**, `aria-describedby` ukazuje na výzvu/názov súboru a hint, fokus sa ukáže obrysom plochy cez `:has(input:focus-visible)`), takže klik aj Enter/medzerník otvoria dialóg a `drop` na plochu vyberie prvý súbor. Vždy jeden súbor; po výbere plocha ukáže názov a veľkosť (`formatFileSize`, `Intl.NumberFormat` s jednotkou kB/MB) a text „kliknite alebo presuňte sem iný súbor“. Pod plochou je jediný chip **CSV** (Figma má JSON, CSV, XLSX; podporované je iba CSV).
- Lokálne kontroly pred odoslaním, chyba sa ukáže pod plochou (`role="alert"`, `aria-describedby` a `aria-invalid` na inpute) a súbor sa zahodí: prípona `.csv` (bez ohľadu na veľkosť písmen, inak „Podporovaný je iba súbor CSV“), veľkosť ≤ `IMPORT_FILE_MAX_BYTES` (10 MB) a po prečítaní (`FileReader.readAsText`, UTF-8) aj veľkosť JSON tela požiadavky `{ fileName, content }` ≤ `IMPORT_REQUEST_MAX_BYTES` (12 MB, `lib/constants.ts`, limit `express.json` na routách importu); obe veľkosti ukážu `errors.IMPORT_FILE_TOO_LARGE`.
- Checkbox **Vytvoriť chýbajúce kľúče** (predvolene zapnutý) v žltom boxe (`--app-color-warning-bg`, text `--app-color-warning-text`).
- **Pokračovať na kontrolu** (disabled bez súboru, `loading` počas preview) zavolá preview. `422 IMPORT_FILE_INVALID` → `ImportIssueList` (`role="alert"`) s `errors.IMPORT_FILE_INVALID` a zoznamom chýb; každá chyba je preložená veta z `importIssues.<CODE>` s `params` a pozíciou („Riadok 812: očakávaných 10 stĺpcov, nájdených 11“, „Riadok 1, stĺpec 3: …“; `lib/importIssues.ts`, prázdny `missing`/`extra` sa ukáže ako „–“), a keď `total` prevyšuje počet vrátených chýb, „a ďalších N“. Výber iného súboru zoznam zmaže. `413` a iné chyby → `errors.<CODE>` pod plochou.

**Krok 2 – Kontrola** (bez Figmy, návrh podľa Tolgee v štýle `LanguagesTable`):

- `ImportReviewTable` (**Stĺpce jazykov v súbore**, min. šírka 48 rem, vodorovný posun): riadok pre každý stĺpec jazyka zo súboru. Stĺpce **Jazyk** (Mantine `Select` s prístupným menom „Jazyk pre stĺpec {{tag}}“, možnosti „English name (tag)“ z jazykov projektu a **Preskočiť**; jazyk priradený inému stĺpcu je disabled, lebo BE odmieta ten istý jazyk dvakrát), **Stĺpec v súbore** (tag monospace a „stĺpec N“), **Preklady**, **Nepreložené**, **Upozornenia** a **Nové / zmenené**.
    - `match: PROJECT` → select predvyplnený jazykom z preview. `CATALOG` a `UNKNOWN` → select prázdny (placeholder **Vyberte jazyk**), riadok má žlté pozadie a pod selectom text „Jazyk ru nie je v projekte.“ s tlačidlami **Pridať jazyk** (prístupné meno „Pridať jazyk ru“, iba `CATALOG`; `useCreateProjectLanguageMutation` s tagom, po úspechu aj po `409 LANGUAGE_TAKEN` sa preview automaticky zopakuje a stĺpec sa spáruje) a **Preskočiť** (prístupné meno „Preskočiť stĺpec ru“, nastaví select na Preskočiť); pri `UNKNOWN` „Jazyk pl nie je v katalógu. Priraďte stĺpec jazyku projektu alebo ho preskočte.“ a iba **Preskočiť**. Nerozhodnutý riadok sa pri importe pošle ako preskočený (`languageId: null`). Pri opakovanom preview (po Pridať jazyk alebo po Späť) ostáva každá už urobená voľba zachovaná, aj Preskočiť alebo iný jazyk na stĺpci `PROJECT`; iba stĺpec bez voľby dostane jazyk z preview (`PROJECT`), inak ostane nerozhodnutý. Výber iného súboru v kroku 1 preview aj voľby zahodí.
    - **Upozornenia**: 0 ako text, inak tlačidlo so žltým trojuholníkom (`AlertTriangle`), počtom, `aria-expanded` a `aria-controls` (meno „N upozornení pre stĺpec sk“), ktoré rozbalí riadok so zoznamom upozornení `PLACEHOLDER_MISMATCH` a `BASE_LANGUAGE_UNTRANSLATED` toho stĺpca (prvých 20, potom „a ďalších N“).
    - **Nové / zmenené**: `new / changed` z `changes` iba pre stĺpec `PROJECT`, ktorý má jazyk z preview; ručne priradený alebo preskočený stĺpec ukáže „—“.
- Súhrn (karta pod tabuľkou): „X nových kľúčov“ (pri vypnutom checkboxe „X nových kľúčov sa nevytvorí“), „Y prekladov sa prepíše“ (súčet `changed`), „Z nových prekladov“ (súčet `new`) – obe iba zo stĺpcov s jazykom z preview; ak je niektorý stĺpec priradený ručne, text „Počty sú približné: ručne priradené stĺpce sa do nich nepočítajú.“ (preview nemá `changes` pre stĺpce `CATALOG`/`UNKNOWN`). Ďalej počet `BASE_LANGUAGE_UNTRANSLATED`, „N stĺpcov sa preskočí“ (keď je aspoň jeden stĺpec preskočený alebo nerozhodnutý), zbalený zoznam `PLACEHOLDER_MISMATCH` (tlačidlo „Rozdiely v premenných (N)“ s `aria-expanded` a `aria-controls`, Mantine `Collapse`; nadpis súhrnu je `h4` a zoznam má cez `aria-labelledby` prístupné meno **Súhrn**) a „a ďalších N upozornení“, keď `warningsTotal` prevyšuje vrátené upozornenia. Slovenské a české plurály sú v kľúčoch `_one/_few/_many/_other`.
- Päta: **Späť** (vráti krok 1, súbor a zoznam ostávajú) a **Importovať** (disabled, kým nie je priradený aspoň jeden stĺpec; `loading` počas importu). Import pošle `fileName`, `content`, `columns: [{ columnIndex, languageId | null }]` pre každý stĺpec jazyka a `createMissingKeys`. Úspech → zelená notifikácia „Import dokončený: X nových kľúčov, Y nových prekladov, Z prepísaných.“ (tri časti s vlastnými plurálmi `importModal.successKeys/successTranslations/successOverwritten`, napr. „1 nový kľúč, 2 nové preklady, 0 prepísaných“), zatvorenie a reset. `422` → návrat do kroku 1 so zoznamom chýb, `400 IMPORT_COLUMNS_INVALID` a iné chyby → `errors.<CODE>` pod súhrnom (`role="alert"`), modál ostáva otvorený.

Rozhodnutia bez Figmy: tabuľka kontroly a súhrn sú v štýle kariet tabuľky jazykov; nerozhodnutý stĺpec neblokuje import (správa sa ako preskočený); krok 2 nemá tlačidlo **Zrušiť import** z plánu (**Zrušiť** je iba v kroku 1, v kroku 2 je **Späť** a zrušenie je krížik alebo Esc); žlté tóny majú vlastné tokeny `--app-color-warning-*`, lebo Mantine `yellow-light-color` nemá na krémovom pozadí dostatočný kontrast.

## Stránka Jazyky projektu

Podľa Figmy `3:812` bez drobčekov a ikony `?`, vnútri `AppLayout` na route `/projects/$projectSlug/languages` (`ProjectLanguagesPage`, člen aj `ADMIN`, položka **Jazyky** v sidebari projektu medzi Nastaveniami a Členmi). Obsah má šírku najviac 1200 px a padding 32 px ako stránka Používatelia. Pridať sa dá iba jazyk z katalógu `SUPPORTED_LANGUAGES` v `@locale/shared`. Do 2026-10-18 bola stránka globálna na `/languages` iba pre ADMIN-a.

- Hlavička: `PageIntro` s `titleSize="h2"` (Lokalizácia / Jazyky / popis z Figmy) a vpravo primárne tlačidlo **Pridať jazyk** s ikonou `Plus`. Tlačidlo je disabled, kým sa zoznam nenačíta, a keď sú pridané všetky jazyky z katalógu.
- `LanguagesTable`: karta ako pri používateľoch, stĺpec **Jazyk** a úzky stĺpec s akciami, ktorého hlavička má len skrytý text „Akcie“ (`VisuallyHidden`) pre čítačky obrazovky. Riadok má výšku 78 px: kruhová vlajka 40 px (`LanguageFlag`), anglický názov 14 / 20 / 600 a pod ním pôvodný názov a tag (`slovenčina · sk`, 10 px `--app-color-muted`), pri základnom jazyku odznak **ZÁKLADNÝ** (Mantine `Badge`, 64 × 22 px ako Figma `3:885`, text 9 / 13,5 / 700, pozadie `--app-color-brand-tint`, text `--app-color-eyebrow`). Odznak má pevnú výšku 22 px, bez okraja Mantine a s horným paddingom 1 px, aby boli veľké písmená opticky v strede (pri symetrickom paddingu boli asi o 1 px vyššie). `line-height` ostáva 1,5, lebo label odznaku má `overflow: hidden` a nižší riadok by orezal dĺžne nad Á a Ý. Vpravo ikona koša (`RowAction`, tooltip **Odobrať**, prístupné meno „Odobrať jazyk {{name}}“, pri základnom jazyku disabled). Úprava názvov a vlajky nie je, berú sa z katalógu. Poradie je z API (základný prvý, potom podľa tagu).
- Stavy mimo Figmy: načítavanie (3 riadky `Skeleton`, `aria-busy`), prázdny zoznam (text „Projekt zatiaľ nemá žiadne jazyky.“ a tlačidlo **Pridať jazyk**) a chyba (text „Zoznam jazykov sa nepodarilo načítať.“, `errors.<CODE>` a **Skúsiť znova**).
- Názvy jazykov sú dáta z API, neprekladajú sa. Ostatné texty sú pod kľúčmi `languagesPage.*`.

Odchýlky od Figmy (rozhodnuté v pláne `docs/plans/languages.md`): chýbajú stĺpce **Preložené**, **Na kontrolu** a **Pokrytie** (štatistiky na jazyk zatiaľ ukazujú iba karty na stránke Preklady), namiesto textového odznaku `SK` je kruhová vlajka, druhý riadok ukazuje pôvodný názov a tag (Figma „Zdrojový jazyk“ alebo tag).

### Vlajky

Vlajky na stránke Jazyky projektu sú SVG z [HatScripts/circle-flags](https://github.com/HatScripts/circle-flags), navrhnuté ako kruhové. Licencia MIT, text licencie je v `src/assets/flags/LICENSE.md` vedľa zdrojových SVG (`at`, `bg`, `cz`, `gb`, `hr`, `hu`, `ro`, `ru`, `sk`). Grafika vlajok sa neupravuje.

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
- **Odobrať jazyk** (`ConfirmDeleteModal`, šírka 440 px): každé odobratie ide cez potvrdenie „Naozaj chcete odobrať jazyk {{name}} ({{tag}}) z projektu?“ s tlačidlami **Zrušiť** a červeným **Odobrať** (`loading`). Úspech → zelená notifikácia „Jazyk {{name}} bol odobraný z projektu.“ a zatvorenie. `404` zatvorí modál s červenou notifikáciou, `409 LANGUAGE_IS_BASE` ukáže červenú notifikáciu, potvrdenie ostane otvorené a zoznam sa načíta znova (riadok dostane odznak **Základný** a **Odobrať** v jeho menu je disabled).
- Fokus po zatvorení: Mantine vracia fokus na prvok, ktorý mal fokus pri otvorení modálu, a ten už nemusí existovať. `ProjectLanguagesPage` si preto pamätá tlačidlo, ktoré modál otvorilo (kôš v riadku, **Pridať jazyk** v hlavičke alebo v prázdnom stave), a po zatvorení vráti fokus naň. Ak tlačidlo zmizlo alebo je disabled (riadok sa odstránil, prázdny stav po pridaní jazyka, pridaný posledný jazyk z katalógu), fokus dostane tabuľka (`tabIndex={-1}`, prístupné meno „Zoznam jazykov“). Po odstránení jazyka ide fokus vždy na tabuľku.

## Stránka Môj profil

Podľa Figmy `3:1762` bez sidebaru, drobčekov a ikony `?`, vnútri `AppLayout` na route `/profile` (ADMIN aj EDITOR). Obsah má šírku najviac 980 px a padding 32 px, karty sú pod sebou s medzerou 20 px. MVP ukladá iba meno a priezvisko, ostatné prvky sú zobrazené ako Mantine `disabled` (bez tooltipu a vysvetľujúceho textu).

- Hlavička: `PageIntro` s `titleSize="h2"` (Používateľský účet / Môj profil / popis).
- `ProfileCard`: hlavička 112 px s ružovým gradientom (`--app-color-brand-tint` → `--app-color-surface-muted`, svetlá `brand.0` → `slate.0`, tmavá stlmená ružová → `dark.7`), avatar 88 px (`--app-color-avatar`, okraj 4 px `--app-color-surface`, radius `xl`, iniciály 20 px / 700 cez `getInitials`, `aria-hidden`, lebo hneď za ním je nadpis s celým menom), meno 18 / 28 / 700 (bez mena sa zobrazí email) a globálna rola (`Administrátor` / `Člen`, kľúče `roles.<ROLE>`, rovnaké ako v sidebari). Tlačidlo **Zmeniť fotografiu** s ikonou `Upload` je disabled. Karta zobrazuje uložené údaje, nie rozpísaný formulár.
- **Osobné údaje** (`PersonalDetailsSection` v karte `ProfileSection`): **Meno** a **Priezvisko** sú editovateľné, **E-mailová adresa** je disabled s emailom používateľa, **Pracovná pozícia** je disabled a prázdna s placeholderom „Napr. Product manager“ (pole v DB neexistuje). Dve stĺpce od šírky `sm`.
- **Preferencie** (`PreferencesSection`): **Jazyk rozhrania** je Mantine `Select` (Slovenčina / Čeština / English, kľúče `topBar.languages.<jazyk>.name`, šípka `ChevronDown` z Figmy). Zmena volá `i18n.changeLanguage` rovnako ako `LanguageSwitcher` v hornej lište, jazyk sa prepne hneď a uloží do `localStorage`, nie cez **Uložiť profil**. **E-mailové oznámenia**: tri disabled `Switch` (všetky vypnuté) s popisom, skupina má `role="group"` s nadpisom ako menom. Mantine dáva popis do `<label>`, takže je súčasťou prístupného mena prepínača.
- **Heslo a zabezpečenie** (`SecuritySection`): ikona `Shield`, text „Heslo bolo naposledy zmenené {{relative}}.“ z `passwordChangedAt` cez `formatRelativeTime`, tlačidlo **Zmeniť heslo** je disabled.
- **Uložiť profil** vpravo dole: React Hook Form + `zodResolver(updateProfileRequestSchema)` zo `@locale/shared` (chyby cez `toValidationCode` → `validation.<CODE>`), polia predvyplnené z profilu (`null` → prázdny reťazec). Tlačidlo je disabled, kým sa formulár nezmení (`isDirty`), počas requestu je `loading` a druhé odoslanie sa ignoruje. Úspech → zelená notifikácia „Profil bol uložený.“ a `reset` na uložené hodnoty. `400 VALIDATION_ERROR` → `setError` pri poliach podľa `details`, `409 SLUG_TAKEN` → chyba pri slugu, iná chyba → červená notifikácia `errors.<CODE>`.
- Stavy mimo Figmy: načítavanie (4 Mantine `Skeleton` vo výške kariet, kontajner má `aria-busy`) a chyba načítania (text „Profil sa nepodarilo načítať.“, preklad `errors.<CODE>` a tlačidlo **Skúsiť znova**, ktoré zavolá `refetch`).

Odchýlky od Figmy: polia a select majú výšku 44 px a text 12 px / 600 z theme (Figma 40 px, select 16 px), prepínače majú Mantine veľkosť `md` (46 × 24 px, Figma 44 × 24 px), disabled prvky majú vzhľad Mantine `disabled`, pri role chýba „· Organizácia1“ (organizácie z aplikácie vypadli, používateľ patrí k projektom). Tmavá schéma nie je vo Figme, farby stránky idú cez premenné `--app-color-*` (viď Farebné schémy).

## Zoznam projektov

Index `/` (`ProjectsPage`) v `HomeLayout`, obsah najviac 980 px a padding 32 px. Hlavička `PageIntro` (Prehľad / Projekty) a tlačidlo **Nový projekt**. Organizácie nie sú: `EDITOR` vidí projekty, kde je členom, `ADMIN` všetky.

- `ProjectsList`: karta so zoznamom `<ul aria-label="Zoznam projektov">`. Riadok má štvorcový avatar 48 px s iniciálami názvu (`getProjectInitials`) v primárnej farbe projektu (text čierny alebo biely podľa `isLightColor`), názov ako odkaz na Preklady `/projects/$projectSlug/translations` (roztiahnutý na celý riadok cez `::after`), slug a vpravo dve ikony s tooltipom bez menu: ozubené koleso (`Settings`, odkaz na nastavenia, **Nastavenia projektu {{name}}**) a `LogOut` (**Opustiť projekt {{name}}**, iba pri `isMember`, pri hoveri červená, otvorí `LeaveProjectModal`). Počet kľúčov, progress a vlajky zo screenshotu starého systému v zozname zatiaľ nie sú (štatistiky má stránka Preklady).
- Stavy: `Skeleton` riadky (`aria-busy`), prázdny stav, chyba s **Skúsiť znova** (po úspechu fokus na zoznam).
- **Nový projekt** (`CreateProjectModal` v `AppModal`): Názov, Slug a **Jazyky** (Mantine `MultiSelect` s vyhľadávaním, rovnaké položky s vlajkou ako v Pridať jazyk, vybrané sa zo zoznamu skryjú, Enter po napísaní vyberie prvú zhodu namiesto odoslania formulára; povinné aspoň jeden, prvý vybraný je základný). Slug sa dopĺňa z názvu (`toSlug`: bez diakritiky, malé písmená, pomlčky, najviac 50 znakov), kým ho používateľ sám neupraví. `409 SLUG_TAKEN` → chyba pri slugu. Po úspechu notifikácia a presmerovanie do nastavení nového projektu.
- **Opustiť projekt** (`LeaveProjectModal`, aj z nastavení projektu): potvrdenie s názvom projektu. `409 LAST_MEMBER` → červená notifikácia, modál ostane otvorený. `404` (už nie je členom) → notifikácia, obnovenie zoznamu a zatvorenie.

## Stránka Členovia

`/projects/$projectSlug/members` (`MembersPage`) vnútri `AppLayout`, pre členov aj `ADMIN`. Rovnaký vzhľad a stavy ako stránka Používatelia: tabuľka `MembersTable` (**Zoznam členov**: avatar s iniciálami, meno a pod ním e-mail alebo iba e-mail, dátum pridania do projektu) a **Pridať člena** (`CreateMemberModal`: e-mail a heslo, `409 EMAIL_TAKEN` pri e-maile). Nový člen dostane rolu `EDITOR`. Riadok má ikonu `UserMinus` (`RowAction`, tooltip **Odobrať z projektu**, prístupné meno **Odobrať {{email}} z projektu**), ktorá po potvrdení v `RemoveMemberModal` odoberie člena (účet ostane). Vlastný riadok tlačidlo nemá, na to je Opustiť projekt. `409 LAST_MEMBER` → červená notifikácia. Po zatvorení modálu ide fokus späť na tlačidlo riadku, po odobraní na tabuľku. Úprava člena nie je, meno si každý mení v profile. Projektové role zatiaľ nie sú.

## Stránka Nastavenia projektu

Podľa Figmy `3:1557` bez drobčekov, ikony `?` a zvončeka, doplnená o **Základný jazyk** a **Opustiť projekt** (plány `docs/plans/project-settings.md` a `docs/plans/projects.md`). Vnútri `AppLayout` na route `/projects/$projectSlug/settings`, pre členov projektu aj `ADMIN`. Obsah má šírku najviac 980 px a padding 32 px, karty sú pod sebou s medzerou 20 px. Nastavenia načíta už loader `projectRoute`, stránka používa `useProjectSettingsQuery(projectId)` a `useLanguagesQuery`.

- Hlavička: `PageIntro` s `titleSize="h2"` (Konfigurácia / Nastavenia projektu / popis z Figmy).
- **Základné údaje** (`ProjectBasicsSection` v karte `ProfileSection`): riadky „label vľavo 180 px, pole vpravo“ (mriežka, medzery 24 / 20 px). Label je `<label for>` 12 px / 600 `--app-color-text-secondary`.
    - **Názov projektu** a **Slug projektu** (`TextInput`). Pod slugom nápoveda „Používa sa pri pomenovaní exportovaných súborov.“ (10 px `--app-color-muted`, prepojená cez `aria-describedby`).
    - **Primárna farba**: Mantine `ColorInput` (`format="hex"`, bez kvapkadla, `fixOnBlur={false}`, aby neplatná farba ukázala chybu pri poli a nevrátila sa potichu) a vedľa štítok **Ukážka** s pozadím vo zadanej farbe. Kým zadaná farba nie je platná `#RRGGBB` (`hexColorSchema`), štítok ukazuje uloženú farbu. Text štítka je čierny alebo biely podľa jasu farby (`isLightColor` v `lib/utils.ts`, YIQ, prah 128), v oboch schémach rovnako, lebo leží na farbe používateľa.
    - **Základný jazyk**: `Select` s jazykmi projektu (`useProjectLanguagesQuery`, popis „English (en)“, v zozname a vľavo v poli kruhová vlajka `LanguageFlag`), predvyplnený `baseLanguageId`, mení ho člen aj `ADMIN`. Bez jazykov je disabled s nápovedou „Projekt zatiaľ nemá žiadne jazyky.“ a odkazom **Pridať jazyk do projektu** na stránku Jazyky projektu; formulár sa vtedy uloží bez `baseLanguageId`.
- **Ochrana dynamických segmentov** (`VariableProtectionSection`, karta `ProfileSection` s `withDivider={false}`, bez čiary pod hlavičkou ako vo Figme): `Switch` veľkosti `md` vpravo v boxe `--app-color-surface-muted` (padding 16 px, radius `lg`), label „Chrániť výrazy {{ variable }}“ s popisom. Text `{{ variable }}` ide do prekladu ako parameter `example`, inak by ho i18next bral ako vlastnú premennú. Zapnutá ochrana sa uplatní pri [úprave prekladu v riadku](#úprava-prekladu-v-riadku): text v inom ako základnom jazyku s inými premennými backend odmietne (`400 PLACEHOLDER_MISMATCH`). Import ochranu neuplatňuje, nezhodu iba vypíše ako upozornenie.
- Pätička: vľavo **Opustiť projekt** (`Button variant="outline"`, otvorí `LeaveProjectModal`, po odchode presmeruje na `/`), vpravo **Uložiť zmeny**. `ADMIN`, ktorý nie je členom (podľa `isMember` zo zoznamu projektov), tlačidlo Opustiť projekt nevidí.
- **Uložiť zmeny**: React Hook Form + `zodResolver(updateProjectSettingsRequestSchema)` (chyby cez `toValidationCode` → `validation.<CODE>`). Disabled, kým sa formulár nezmení, počas requestu `loading` a druhé odoslanie sa ignoruje. Úspech → zelená notifikácia „Nastavenia projektu boli uložené.“ a `reset` na hodnoty z odpovede. `400 VALIDATION_ERROR` → `setError` pri poliach podľa `details`, `409 SLUG_TAKEN` → chyba pri slugu, iná chyba (napr. `404 NOT_FOUND`) → červená notifikácia `errors.<CODE>`.
- Stavy mimo Figmy: načítavanie jazykov (2 `Skeleton` vo výške kariet, `aria-busy`), chyba načítania jazykov (nastavenia už načítal loader routy) (text „Nastavenia projektu sa nepodarilo načítať.“, `errors.<CODE>` a **Skúsiť znova**, ktoré znova načíta, čo zlyhalo, a po úspechu dá fokus na Názov projektu). Chyba pri obnovení na pozadí (dáta už sú) formulár neskryje.

Odchýlky od Figmy: polia majú výšku 44 px a text 12 px / 600 z theme (Figma 40 px a 16 px), štvorček farby a hex pole sú jeden `ColorInput` (Figma má dva prvky, 48 px a 128 px), pribudli riadok Základný jazyk a tlačidlo Opustiť projekt (zo screenshotu iného systému), prepínač je 46 × 24 px (Figma 44 × 24 px). Tmavá schéma nie je vo Figme, farby idú cez `--app-color-*`.

### Relatívny čas

`lib/formatRelativeTime.ts`: `formatRelativeTime(isoDate, language, now?)` cez `Intl.RelativeTimeFormat` (`numeric: 'auto'`) s rovnakým mapovaním jazyka ako `formatDate` (`toIntlLocale`: `sk` → `sk-SK`, `en` → `en-GB`, neznámy → `sk`). Vyberie najväčšiu jednotku, ktorá sa zmestí (rok 365 dní, mesiac 30 dní, týždeň, deň, hodina, minúta, sekunda), a zaokrúhli: `pred 3 mesiacmi` / `3 months ago`, `včera` / `yesterday`, `teraz` / `now`. Štvrtý parameter `style` (`'long'` predvolene, `'short'` v tabuľke prekladov) skráti jednotku: `pred 2 min` / `2 min ago`.

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
- Unit test `lib/i18n.test.ts` overí, že každý `ERROR_CODE` a `VALIDATION_CODE` z `@locale/shared` má preklad v `sk`, `cs` aj `en`, že `sk.json`, `cs.json` a `en.json` majú rovnakú sadu kľúčov (chyba vypíše chýbajúce kľúče pre každý jazyk) a že žiadna hodnota nie je prázdny reťazec.
- Unit test `lib/i18nStorage.test.ts` načíta `lib/i18n` vždy nanovo (`vi.resetModules`) a overí, že uložený `en` sa použije, neplatná hodnota a výnimka z `getItem` vrátia `sk` a výnimka zo `setItem` nezhodí zmenu jazyka.
- Prepínač jazyka ukazuje vlajky z balíka `country-flag-icons` (MIT, React SVG komponenty `country-flag-icons/react/3x2`): `SK` pre slovenčinu, `CZ` pre češtinu, `GB` pre angličtinu (angličtina používa britské formáty `en-GB`, čeština `cs-CZ`). Vlajka má 16 px na šírku (pomer 3 : 2), radius 2 px a 1px prstenec `--app-color-border`, aby boli biele časti vidieť aj vo svetlej schéme. Je dekoratívna (`aria-hidden`), prístupné mená možností sa nemenia. Mapovanie jazyk → vlajka je `LANGUAGE_FLAG` v `LanguageSwitcher.tsx`, nový jazyk potrebuje aj vlajku.
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

| Premenná                         | Kde                                                                                                                                                      | Svetlá                                                   | Tmavá                                     |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ----------------------------------------- |
| `--mantine-color-body`           | pozadie stránky                                                                                                                                          | `#F7F8FB`                                                | `#020618` (`slate-950`)                   |
| `--mantine-color-text`           | základný text, odstavec                                                                                                                                  | `slate.5`                                                | `slate.4`                                 |
| `--app-color-surface`            | karta tabuľky, modál, horná lišta (90 %), sidebar, input, karty profilu, okraj avatara profilu                                                           | `white`                                                  | `slate.9`                                 |
| `--app-color-surface-muted`      | hlavička tabuľky, hover položky sidebaru, päta modálu (60 %), koniec gradientu karty profilu                                                             | `slate.0`                                                | `#0B1222` (`dark.7`)                      |
| `--app-color-border`             | okraj inputu, karty, modálu, lišty, sidebaru (80 %), sekundárneho tlačidla, prstenec vlajky                                                              | `slate.2`                                                | `slate.7`                                 |
| `--app-color-border-subtle`      | okraj riadkov tabuľky, oddeľovač v sidebari, oddeľovače v modáli, oddeľovač hlavičky sekcie profilu                                                      | `slate.1`                                                | `slate.8`                                 |
| `--app-color-heading`            | H1                                                                                                                                                       | `black` (`slate-950`)                                    | `slate.0`                                 |
| `--app-color-title`              | „Locale“ v logu, nadpis modálu, meno a nadpisy sekcií profilu                                                                                            | `slate.9`                                                | `slate.1`                                 |
| `--app-color-text-strong`        | text v inpute (placeholder 50 %), emaily, titulok chyby tabuľky a profilu                                                                                | `slate.8`                                                | `slate.2`                                 |
| `--app-color-label`              | label poľa, label prepínača v profile                                                                                                                    | `slate.7`                                                | `slate.3`                                 |
| `--app-color-text-secondary`     | text sekundárneho tlačidla, iniciály v tabuľke, labely v Preferenciách                                                                                   | `slate.6`                                                | `slate.3`                                 |
| `--app-color-muted`              | „WORKSPACE“, ikony a nadpis SPRÁVA v sidebari, rola v sidebari, pätička, hlavička tabuľky, prepínač schémy, krížik, popisy a rola v profile, ikona štítu | `slate.4`                                                | `slate.5`                                 |
| `--app-color-eyebrow`            | malý nadpis nad H1, text aktívnej položky sidebaru, text odznaku ZÁKLADNÝ                                                                                | `brand.7`                                                | `brand.4`                                 |
| `--app-color-avatar`             | avatar v sidebari a v karte profilu (iniciály biele)                                                                                                     | `slate.9`                                                | `slate.7`                                 |
| `--app-color-avatar-muted`       | avatar v tabuľke                                                                                                                                         | `slate.1`                                                | `slate.8`                                 |
| `--app-color-brand-tint`         | pozadie aktívnej položky sidebaru, začiatok gradientu karty profilu (stred cez `color-mix` 60 % s `--app-color-surface-muted`), odznak ZÁKLADNÝ          | `brand.0`                                                | `brand.9` 30 % + `slate.9` (`color-mix`)  |
| `--app-color-untranslated-bg`    | pozadie nepreloženého riadku v tabuľke prekladov                                                                                                         | `red.0` (Mantine)                                        | `red.9` 14 % + `slate.9` (`color-mix`)    |
| `--app-color-warning-bg`         | box Vytvoriť chýbajúce kľúče, nerozhodnutý riadok a zoznam upozornení v modáli importu                                                                   | `yellow.0` (Mantine)                                     | `yellow.9` 16 % + `slate.9` (`color-mix`) |
| `--app-color-warning-text`       | text v týchto boxoch, tlačidlo upozornení (žltý trojuholník)                                                                                             | `orange.9` 60 % + `black` (`color-mix`, Figma `#7B3306`) | `yellow.3`                                |
| `--mantine-color-error`          | okraj a text chyby poľa                                                                                                                                  | `red.6` (Mantine)                                        | `red.6`                                   |
| `--mantine-color-disabled`       | pozadie disabled tlačidla, inputu a dráhy prepínača                                                                                                      | `gray.2` (Mantine)                                       | `dark.5` (`slate-800`)                    |
| `--mantine-color-disabled-color` | text disabled tlačidla a inputu                                                                                                                          | `gray.5` (Mantine)                                       | `dark.2` (`slate-400`)                    |

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

1. SVG sa exportuje z Figmy (Figma MCP) do `src/assets/icons/` (`logo.svg`, `arrow-right.svg`, `bell.svg`, `plus.svg`, `close.svg`, `upload.svg`, `shield.svg`, `chevron-down.svg`, `dots-horizontal.svg` z tlačidla `⋯` v riadku jazyka, Figma `3:901`, dnes iba v menu používateľa (akcie v riadkoch sú explicitné ikony, nie menu `⋯`), `globe.svg` z položky Jazyky v sidebari, Figma `3:1702`, `users.svg` z položky Členovia, Figma `3:1720`, `settings.svg` (ozubené koleso) z položky Nastavenia projektu, Figma `3:1726`, `chevron-selector.svg` (15 px) zo šípky prepínača projektu, Figma `3:393`, zo stránky Preklady (Figma `3:2`) `translate.svg` (položka Preklady v sidebari, `3:407`), `key.svg`, `check.svg` a `file.svg` (ikony kariet, `3:74`, `3:86`, `3:114`) a `search.svg` (vyhľadávanie, `3:125`)). `log-out.svg` (Opustiť projekt v zozname projektov), `trash.svg` (odstránenie administrátora a odobratie jazyka) a `user-minus.svg` (odobratie člena) vo Figme nie sú, sú to ikony Untitled UI `log-out-01`, `trash-01` a `user-minus-01` (24 px, zobrazené 18 px). `bell.svg` sa zatiaľ nepoužíva, zvonček sa do lišty vráti s notifikáciami. `sun.svg` a `moon.svg` (prepínač schémy) vo Figme nie sú, sú to jednoduché ikony 24 px v štýle Lucide s ťahom 1,8; rovnako `alert-triangle.svg` (16 px, upozornenia v modáli importu). Farba ťahu sa v súbore nastaví na `white` (napr. `close.svg` má vo Figme `#90A1B9`), aby ju SVGR nahradil za `currentColor`.
2. `pnpm --filter frontend generate-icons` cez SVGR (`svgr.config.cjs`) vygeneruje TypeScript komponenty do `src/components/Icons/` a barrel `index.ts`, potom spustí ESLint a Prettier.
3. Farba `white` z Figmy sa nahradí za `currentColor`, ikona preberá farbu textu. Predvolená veľkosť je veľkosť z Figmy, mení sa cez `width` a `height`, `viewBox` zostáva.

Použitie: `import { Logo } from '@/components/Icons'`.

Favicon je `public/favicon.svg`: biele logo z `logo.svg` na ružovom štvorci `brand.6` (`#E83E8C`) so zaoblením ako logo v sidebari, odkaz je v `index.html`.

## Testy

Unit testy bežia cez `vp test` v jsdom. `src/test/setup.ts` načíta matchery `@testing-library/jest-dom`, i18n a doplní `matchMedia`, `ResizeObserver`, `scrollTo`, `Element.scrollIntoView` (volá ho dropdown `Select`) a `document.fonts` (počúva ho `Textarea` s `autosize`), ktoré jsdom nemá. Po každom teste vyčistí `queryClient`, mock API, `localStorage` a vráti jazyk na `sk`.

- `renderApp(path)` (`test/renderApp.tsx`) vyrenderuje celú aplikáciu (Mantine s `env="test"`, Query, router s memory history) a vráti router.
- `mockApi(routes)` (`test/mockApi.ts`) nahradí adapter axios inštancie odpoveďami podľa kľúča `METHOD /url` (napr. `GET /auth/me`) a vráti zoznam odoslaných požiadaviek. Skratky `signedInAs(user)` a `signedOut()`, chyby cez `apiError(status, code)`.

## Prístupnosť

Cieľ sú základy WCAG 2.2 úrovne AA. Kontroluje ich rola `accessibility-reviewer` (`.agents/agents/accessibility-reviewer.md`) a dve automatické kontroly:

- **ESLint** `eslint-plugin-jsx-a11y` (config `recommended`) pre `frontend/**/*.tsx`, beží v `pnpm lint` a teda aj v `pnpm verify`. Vidí iba natívne JSX elementy (`img`, `a`, `div` s `onClick`, `autoFocus` …), Mantine komponenty (`Button`, `ActionIcon`, `Modal`) nekontroluje. Posledná verzia pluginu (6.10.2) deklaruje ako peer ESLint najviac 9; s ESLint 10 pravidlá fungujú, `pnpm install` iba vypíše varovanie o peer závislosti.
- **axe** (`@axe-core/playwright`) v E2E teste `e2e/tests/accessibility.spec.ts` skenuje vyrenderované obrazovky v svetlej aj tmavej schéme, viď [Testovanie](./testing.md#prístupnosť-axe).

Pravidlá v kóde:

- `document.title` je „{{page}} – Locale“ (kľúč `documentTitle`). Nastavuje ho `PageIntro` z nadpisu stránky cez hook `hooks/useDocumentTitle.ts`, takže sa mení s navigáciou aj s jazykom UI. Domovská stránka je zoznam projektov s titulkom **Projekty**.
- Notifikácie renderuje `AppNotifications` (`main.tsx`): Mantine `Notifications` s preloženým prístupným menom krížika (`notification.close`, Mantine ho bez `closeButtonProps` nemá). Notifikácia aj `Alert` majú `role="alert"`.
- Chyba z API pri poli (`400` `details`, `409 EMAIL_TAKEN`, `409 LANGUAGE_TAKEN`, `409 SLUG_TAKEN`) presunie fokus na prvé chybné pole (`setError(..., { shouldFocus: true })`, v **Pridať jazyk** na select), aby čítačka prečítala chybu. Chyby z klientskej validácie fokusuje React Hook Form sám (`shouldFocusError`).
- Po úspešnom **Skúsiť znova** v tabuľke používateľov, členov alebo jazykov dostane fokus tabuľka, v zozname projektov zoznam (`tabIndex={-1}`), lebo tlačidlo nahradia riadky. Na stránke Môj profil dostane fokus pole **Meno** (`ProfileForm` s `focusFirstField`).
- Theme má `respectReducedMotion: true`, pri `prefers-reduced-motion` Mantine vypne prechody.

Čo automatické kontroly nezachytia (poradie fokusu, návrat fokusu po modáli, zrozumiteľnosť textov, oznamovanie stavov), kontroluje `accessibility-reviewer` ručne podľa svojho checklistu.

## Inšpirácia

Štruktúra a štýl kódu vychádzajú z FE projektu Notino Landing (atoms, components, pages, Mantine theme, query keys, SVGR ikony). Nové repo na ňom nie je závislé.
