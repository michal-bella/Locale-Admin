---
title: 'Môj profil – implementačný plán (MVP)'
updated: 2026-10-17
notion_page_id:
---

# Môj profil – implementačný plán (MVP)

Obrazovka **Môj profil** podľa Figmy ([node `3-1762`](https://www.figma.com/design/8mjlOXj1MXEqGwkWlf83mZ/Admin-system-for-translations?node-id=3-1762&m=dev)). MVP: prihlásený používateľ (ADMIN aj EDITOR) si upraví **meno a priezvisko**. Ostatné prvky obrazovky sa zobrazia podľa dizajnu, ale sú **disabled**. Postup podľa `.agents/workflows/feature.md` rovnako ako míľnik C: kontrakt na `main`, potom BE a FE paralelne vo vlastných worktree, E2E, review. Po každom kroku checkpoint (feedback loop, `docs/`, commit, krátky report).

## Rozsah

| Prvok z Figmy                                                      | MVP                                                                                     |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| Hlavička stránky (eyebrow „Používateľský účet“, nadpis, podnadpis) | áno, cez `PageIntro`                                                                    |
| Karta profilu: avatar s iniciálami, meno, rola                     | áno (iniciály a meno z uložených údajov, nie z rozpísaného formulára)                   |
| Tlačidlo **Zmeniť fotografiu**                                     | zobrazené, **disabled**                                                                 |
| **Meno**, **Priezvisko**                                           | **editovateľné**                                                                        |
| **E-mailová adresa**                                               | **disabled**, predvyplnená emailom používateľa                                          |
| **Pracovná pozícia**                                               | **disabled**, prázdna (pole v DB neexistuje), placeholder                               |
| **Jazyk rozhrania**                                                | funkčný select, prepne jazyk hneď (nie cez Uložiť)                                      |
| **E-mailové oznámenia** (3 prepínače)                              | zobrazené, **disabled**                                                                 |
| **Heslo a zabezpečenie**, tlačidlo **Zmeniť heslo**                | sekcia zobrazená, tlačidlo **disabled**                                                 |
| Tlačidlo **Uložiť profil**                                         | ukladá iba meno a priezvisko                                                            |
| Sidebar, drobčeky, ikona `?`                                       | **nie** (layout Fázy 1 bez sidebaru, rovnako ako stránka Používatelia)                  |

Mimo rozsahu: zmena emailu, pracovnej pozície, fotografie, hesla, notifikácií (žiadne nové stĺpce v DB, žiadna migrácia).

## Rozhodnutia 

- **Route:** `/profile`, pod `authenticatedRoute`, pre obe role (bez `requireRole`). Lazy stránka podľa skillu `add-page`.
- **Vstup:** nová položka **Môj profil** v `UserMenu` nad položkou Používatelia, viditeľná pre všetkých.
- **Kontrakt** (`packages/shared/src/profile.ts`):
  - `personNameSchema` = `z.string().trim().min(1).max(PERSON_NAME_MAX_LENGTH)`, konštanta `PERSON_NAME_MAX_LENGTH = 100` v `packages/shared`.
  - `updateProfileRequestSchema = { firstName: personNameSchema, lastName: personNameSchema }` → `UpdateProfileRequest`. Rovnaká schéma pre FE formulár aj BE. Obe polia povinné (prázdna hodnota → `REQUIRED`, dlhá → `TOO_LONG` s `max`). Zod odstráni ostatné kľúče, takže poslaný `email` alebo `role` sa ignoruje.
  - `profileSchema = authUserSchema.extend({ passwordChangedAt: z.iso.datetime() })` → `Profile`, telo `GET` aj `PATCH`.
  - Žiadny nový `ERROR_CODE` ani `VALIDATION_CODE`.
- **API** (router `/api/profile` za `createRequireAuth`):
  - `GET /api/profile` → `200 Profile` (prihlásený používateľ zo session).
  - `PATCH /api/profile` → `200 Profile`, uloží orezané `firstName`/`lastName`. CSRF rieši globálny middleware.
  - `401 AUTH_UNAUTHENTICATED` bez session, `400 VALIDATION_ERROR` s `details`.
  - Prečo nie rozšírenie `/api/auth/me`: `me` drží guardy a top bar (`staleTime: Infinity`), profil potrebuje navyše `passwordChangedAt` a neskôr ďalšie polia (pozícia, preferencie). `PATCH` na `auth` routeri by miešal autentifikáciu s profilom.
- **FE:**
  - `api/profile/` (`profileQuery`, `useUpdateProfileMutation`), `QUERY_KEYS.PROFILE()`.
  - Po úspešnom `PATCH`: `setQueryData` pre `PROFILE` aj `AUTH.ME` (iniciály a meno v top bare sa zmenia hneď bez ďalšieho requestu), zelená notifikácia, `reset(values)` formulára.
  - Formulár React Hook Form + `zodResolver(updateProfileRequestSchema)`, predvyplnený z profilu. Prázdne `null` hodnoty z DB → prázdny reťazec. **Uložiť profil** je `loading` počas requestu, disabled ak formulár nie je zmenený (`!isDirty`).
  - Chyby: `400` → `setError` podľa `details`, iná chyba → červená notifikácia ``t(`errors.${code}`)``.
  - Stavy mimo Figmy: loading (`Skeleton` kariet), chyba načítania s tlačidlom **Skúsiť znova** (`refetch`).
  - Disabled prvky: Mantine `disabled` (`TextInput`, `Switch`, `Button`), aby boli neaktívne aj pre klávesnicu a čítačku. Bez tooltipu a vysvetľujúceho textu.
  - **Rola v karte profilu:** iba globálna rola (`Administrátor` / `Editor`) cez i18n, bez „· Organizácia1“ (organizácie ešte nie sú).
  - **Text o hesle:** „Heslo bolo naposledy zmenené {{relatívny čas}}“ z `passwordChangedAt` cez `Intl.RelativeTimeFormat` podľa jazyka (helper v `lib/`, bez knižnice).
  - Ikony z Figmy cez SVGR: upload (Zmeniť fotografiu), štít (Heslo a zabezpečenie), šípka selectu ak treba.
  - Avatar 88 px, štvorcový s radiusom podľa Figmy, ružový gradient v hlavičke karty, hodnoty z `get_design_context` (skill `figma-to-code`).
  - i18n kľúče `profilePage.*` v `sk.json` aj `en.json`.

## Kroky

### P1. Kontrakt (orchestrátor, `main`)

- `profile.ts` podľa rozhodnutí, export z `index.ts`.
- Unit testy: trim mien, prázdne/whitespace meno → `REQUIRED`, 101 znakov → `TOO_LONG` s `max: 100`, chýbajúce polia → `REQUIRED`, `email`/`role` v tele sa odstránia, `profileSchema` neprepustí `passwordHash`.
- **Overenie:** `pnpm --filter @locale/shared test`, `pnpm lint`, `pnpm typecheck`.

### P2. Backend (Backend Developer, worktree `agent/be-profile`)

- `routes/profile.routes.ts`, `controllers/profile.controller.ts`, `services/profile.service.ts` (explicitný `select`, mapovanie `toProfile`), mount `app.use('/api/profile', …)` pred `notFoundMiddleware`.
- Integračné testy (`backend/test/profile.test.ts`): `GET` presný tvar tela pre ADMIN aj EDITOR, `PATCH` uloží orezané hodnoty a vráti nový profil, ďalší `GET /api/auth/me` vráti nové meno, `email`/`role` v tele sa ignorujú (rola ostane `EDITOR`), `400` s `details` (prázdne, dlhé s `params.max`, chýbajúce), `401` bez session pre `GET` aj `PATCH`, `403 CSRF_REJECTED` na `PATCH` bez hlavičky, `PATCH` mení iba vlastného používateľa.
- `docs/api/profile.md`, `docs/api/README.md`.
- **Overenie:** root `pnpm lint`, `pnpm --filter backend typecheck|test|test:integration`, `check-scope.sh backend-developer`.

### P3. Frontend (Frontend Developer, worktree `agent/fe-profile`, paralelne s P2)

- Route `/profile` (`profileRoute.ts` + `profileRoute.lazy.ts`), položka v `UserMenu`.
- `api/profile/`, `QUERY_KEYS.PROFILE`.
- `ProfilePage` + komponenty (`ProfileCard`, `PersonalDetailsForm`, `PreferencesSection`, `SecuritySection`), ikony cez `generate-icons`, helper relatívneho času v `lib/`, preklady `sk` aj `en`.
- Unit testy: predvyplnenie, disabled polia a prepínače (email, pozícia, notifikácie, Zmeniť fotografiu, Zmeniť heslo), klientská validácia, `400` pri poli, úspech → notifikácia a nové iniciály v top bare, Uložiť disabled bez zmeny, loading a chyba + retry, relatívny čas v SK aj EN, položka v menu pre ADMIN aj EDITOR.
- `docs/frontend.md` (route, stránka, stavy).
- **Overenie:** root `pnpm lint`, `pnpm --filter frontend typecheck|test|build` (bez varovania o chunku), `check-scope.sh frontend-developer`.

### P4. Integrácia (orchestrátor)

- `check-scope.sh` pre obe vetvy, `git merge --no-ff --no-edit`, `pnpm install`, `pnpm verify`, `pnpm stack:up`, `api-smoke` (`/api/profile`: 401, 400, 403 CSRF, 200).

### P5. E2E (E2E Tester, worktree `agent/e2e-profile`)

- EDITOR otvorí profil z menu, zmení meno a priezvisko, uloží → notifikácia, iniciály v top bare sa zmenia bez reloadu, po reloade ostanú hodnoty.
- Prázdne meno → chyba pri poli. Disabled prvky nie sú editovateľné. Neprihlásený `/profile` → `/login`, `/api/profile` → 401.
- Test mení vlastného E2E používateľa (prefix `e2e-editor-`), nie seed admina.
- **Overenie:** `pnpm test:e2e` (Chromium + WebKit), `check-scope.sh e2e-tester`.

### P6. Review a vizuálne porovnanie

- Code Reviewer nad celým diffom, nálezy `high`/`medium` späť agentom.
- Orchestrátor jednorazovo porovná Playwright screenshot `/profile` s `get_screenshot` `3:1762`, rozdiely idú používateľovi.
- `docs/changelog.md`, `docs/README.md` (nové stránky), `docs/database.md` iba ak sa niečo zmení (podľa plánu nie).
- **Overenie:** `pnpm verify`, `pnpm test:e2e`, všetky body rozsahu splnené.

## Akceptačné kritériá

1. ADMIN aj EDITOR otvorí **Môj profil** z menu používateľa na `/profile`.
2. Meno a priezvisko sú predvyplnené, dajú sa zmeniť a uložiť. Po uložení sa meno a iniciály zmenia v karte profilu aj v top bare bez reloadu a ostanú aj po reloade.
3. Prázdne alebo príliš dlhé meno zobrazí preloženú chybu pri poli (FE aj BE validácia z jednej schémy).
4. Email, pracovná pozícia, notifikácie, Zmeniť fotografiu a Zmeniť heslo sú viditeľné a disabled. Email a rolu nejde zmeniť ani priamo cez API.
5. Všetky texty v `sk` aj `en`, `pnpm verify` a `pnpm test:e2e` prechádzajú.

## Odpovede na otázky (2026-10-17)

Návrh plánu bol schválený, otvorené otázky sa riešia odporúčaným variantom:

1. Route `/profile`, položka **Môj profil** v menu používateľa pre ADMIN aj EDITOR.
2. **Jazyk rozhrania** je funkčný select (`Slovenčina` / `English`), prepne jazyk hneď rovnako ako SK/EN v top bare, nie cez Uložiť profil.
3. Meno aj priezvisko sú povinné, max. 100 znakov.
4. Text „Heslo bolo naposledy zmenené …“ sa zobrazuje z `passwordChangedAt` cez `Intl.RelativeTimeFormat`.
5. Disabled prvky bez tooltipu a bez vysvetľujúceho textu.
6. Prepínače notifikácií sú všetky vypnuté (dáta neexistujú).
7. Pracovná pozícia je prázdne disabled pole s placeholderom.
