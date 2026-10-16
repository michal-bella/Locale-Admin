---
title: 'Frontend'
updated: 2026-10-16
notion_page_id:
---

# Frontend

React SPA na Vite+ (`vp dev`, `vp build`, `vp test`) s Mantine 9, Tailwind 4, TanStack Router a Query, axios a react-i18next.

## Skripty

Spúšťajú sa z rootu cez `pnpm --filter frontend <skript>`.

| Skript           | Čo robí                                                                     |
| ---------------- | --------------------------------------------------------------------------- |
| `dev`            | dev server na `http://localhost:5173`, `/api` proxuje na `localhost:3000`   |
| `build`          | produkčný build do `frontend/dist`                                          |
| `preview`        | servíruje `dist` na `http://localhost:4173` (s rovnakou `/api` proxy)       |
| `test`           | unit testy (Vitest cez Vite+, prostredie jsdom), súbory `src/**/*.test.tsx` |
| `typecheck`      | `tsc --noEmit`                                                              |
| `generate-icons` | vygeneruje React komponenty ikon zo SVG (viď Ikony)                         |

## Štruktúra `src/`

| Priečinok     | Obsah                                                                        |
| ------------- | ---------------------------------------------------------------------------- |
| `atoms/`      | malé obaly nad Mantine (`ButtonLink`)                                        |
| `components/` | zložené komponenty (`Brand`, `CenteredLayout`, `PageIntro`, `Icons/`)        |
| `pages/`      | obrazovky rout (`HomePage`, `NotFoundPage`)                                  |
| `routes/`     | strom rout a router                                                          |
| `api/`        | axios inštancia `http`, `queryClient`, `QUERY_KEYS`, `getApiErrorCode`       |
| `lib/`        | `constants.ts`, `enum.ts`, nastavenie i18n                                   |
| `locales/`    | preklady `sk.json`, `en.json`                                                |
| `styles/`     | Mantine theme, globálne CSS s poradím vrstiev, prekrytia Mantine komponentov |
| `assets/`     | `icons/` (zdrojové SVG z Figmy)                                              |
| `types/`      | typy iba pre FE (typované i18n kľúče)                                        |

Priečinok komponentu obsahuje `Component.tsx`, `types.ts` (props) a voliteľne `Component.module.css`. Komponenty sa exportujú ako default a importujú plnou cestou (`@/components/Brand/Brand`). Barrel súbor je iba `components/Icons/index.ts`.

## Routing

TanStack Router s routami v kóde (ADR 0002). Root route má kontext s `queryClient` pre budúce guardy.

| Cesta        | Stránka                                         |
| ------------ | ----------------------------------------------- |
| `/`          | `HomePage` (vo Fáze 1 prázdna)                  |
| neexistujúca | `NotFoundPage` (`notFoundComponent` root route) |

Produkčný server (nginx) musí pre neznáme cesty vrátiť `index.html` (SPA fallback), inak refresh na hlbokej route skončí chybou servera.

## API

- Jediná axios inštancia `api/http.ts`: `baseURL: '/api'`, `withCredentials: true`.
- Interceptor posiela pri každej požiadavke `X-Requested-With: XMLHttpRequest`. Mutácie (`POST`, `PUT`, `PATCH`, `DELETE`) bez tela pošlú `{}`, aby odišla hlavička `Content-Type: application/json` (ochrana proti CSRF na BE).
- Query kľúče sú iba v `QUERY_KEYS` (`api/queryKeys.ts`).
- `getApiErrorCode(error)` vráti `ERROR_CODE` z odpovede podľa `errorResponseSchema` z `@locale/shared`, inak `UNKNOWN`. Text chyby sa zobrazuje iba cez preklad `errors.<CODE>`, nikdy z `message`.

## i18n

- react-i18next, jazyky `sk` (predvolený aj záložný) a `en`, kľúče v objektovej štruktúre (`notFoundPage.title`).
- Zvolený jazyk sa číta z `localStorage` (kľúč `locale`). Ak `localStorage` nie je dostupný alebo hodnota nie je platná, použije sa `sk`. Pri zmene jazyka sa hodnota uloží a aktualizuje sa `<html lang>`.
- Chyby API: `errors.<ERROR_CODE>` a `errors.UNKNOWN`. Validácia: `validation.<VALIDATION_CODE>`, pri `TOO_SHORT` a `TOO_LONG` s parametrami `{{min}}` a `{{max}}`.
- Unit test `lib/i18n.test.ts` overí, že každý `ERROR_CODE` a `VALIDATION_CODE` z `@locale/shared` má preklad v `sk` aj `en`.
- Kľúče sú typované podľa `sk.json` (`types/i18next.d.ts`), preklep v kľúči zachytí `typecheck`.

## Štýly

- Poradie vrstiev v `styles/global.css`: `theme, base, mantine, components, utilities`. Tailwind preflight (`base`) je pod Mantine, takže nerozbije jeho komponenty. Tailwind utility sú nad Mantine.
- Mantine má prednosť: theme a prekrytia komponentov (`styles/mantineTheme.ts`), potom CSS moduly, Tailwind iba na layout a spacing.
- Font DM Sans sa hostuje lokálne z balíka `@fontsource-variable/dm-sans`. Nastavuje sa v Mantine theme (`fontFamily`, `headings.fontFamily`) aj v Tailwind `--font-sans`.
- Aplikácia je iba vo svetlej téme.

## Mapovanie Figma → theme

Figma súbor nemá premenné. Hodnoty sú zo štýlov login screenu (node `5:2861`) cez `get_design_context`.

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
| `#E2E8F0`        | okraj inputu                       | `slate.2` (`slate-200`)                         |
| `#E83E8C`        | tlačidlo, pozadie loga             | `brand.6` (`primaryColor`)                      |
| `#D72F7C`        | malý nadpis nad H1 („PRIHLÁSENIE“) | `brand.7`                                       |

Primárna farba `brand` má 10 odtieňov: `#FDEEF5`, `#FBD9E8`, `#F6B0D0`, `#F184B6`, `#ED5F9F`, `#EA4B93`, `#E83E8C`, `#D72F7C`, `#B9246A`, `#961A55`. Odtiene 6 a 7 sú z Figmy, ostatné sú dopočítané.

### Radius a tiene

| Figma                               | Kde               | Theme                         |
| ----------------------------------- | ----------------- | ----------------------------- |
| 10 px                               | tlačidlo          | `radius.md` (`defaultRadius`) |
| 12 px                               | input, ikona loga | `radius.lg`                   |
| drop shadow `0 4 11` `#E83E8C` 20 % | tlačidlo          | `shadows.primary`             |
| drop shadow `0 5 14` `#E83E8C` 30 % | ikona loga        | `shadows.primary-lg`          |

Ostatné radiusy: `xs` 4 px, `sm` 8 px, `xl` 16 px.

### Typografia

| Figma (veľkosť / riadok / váha)  | Kde                    | Theme                                             |
| -------------------------------- | ---------------------- | ------------------------------------------------- |
| 32 / 48 / 700, tracking −1,12 px | H1                     | `headings.sizes.h1`, `letter-spacing: -0.035em`   |
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

1. SVG sa exportuje z Figmy (Figma MCP) do `src/assets/icons/` (napr. `logo.svg`, `arrow-right.svg`).
2. `pnpm --filter frontend generate-icons` cez SVGR (`svgr.config.cjs`) vygeneruje TypeScript komponenty do `src/components/Icons/` a barrel `index.ts`, potom spustí ESLint a Prettier.
3. Farba `white` z Figmy sa nahradí za `currentColor`, ikona preberá farbu textu. Predvolená veľkosť je veľkosť z Figmy, mení sa cez `width` a `height`, `viewBox` zostáva.

Použitie: `import { Logo } from '@/components/Icons'`.

## Testy

Unit testy bežia cez `vp test` v jsdom. `src/test/setup.ts` načíta matchery `@testing-library/jest-dom`, i18n a doplní `matchMedia` a `scrollTo`, ktoré jsdom nemá.

## Inšpirácia

Štruktúra a štýl kódu vychádzajú z FE projektu Notino Landing (atoms, components, pages, Mantine theme, query keys, SVGR ikony). Nové repo na ňom nie je závislé.
