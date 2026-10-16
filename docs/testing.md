---
title: 'Testovanie'
updated: 2026-10-16
notion_page_id:
---

# Testovanie

Unit testy (Vitest, vo frontende Vite+), integračné testy backendu (Vitest + supertest voči test DB `locale_test`) a E2E testy (Playwright voči produkčnému Docker stacku).

## Druhy testov

| Druh            | Kde                                | Nástroj                                           | Príkaz (z rootu)                    |
| --------------- | ---------------------------------- | ------------------------------------------------- | ----------------------------------- |
| Unit (shared)   | `packages/shared/src/**/*.test.ts` | Vitest                                            | `pnpm --filter @locale/shared test` |
| Unit (backend)  | `backend/src/**/*.test.ts`         | Vitest, bez DB                                    | `pnpm --filter backend test`        |
| Unit (frontend) | `frontend/src/**/*.test.ts(x)`     | Vite+ (`vp test`, jsdom, Testing Library)         | `pnpm --filter frontend test`       |
| Integračné (BE) | `backend/test/**/*.test.ts`        | Vitest + supertest, reálny Postgres `locale_test` | `pnpm test:integration`             |
| E2E / smoke     | `e2e/`                             | Playwright voči `http://localhost:8080`           | `pnpm test:e2e`                     |

## Súhrnné príkazy

| Príkaz                  | Čo spustí                                                                                     |
| ----------------------- | --------------------------------------------------------------------------------------------- |
| `pnpm test`             | všetky unit testy (shared, backend, frontend)                                                 |
| `pnpm test:integration` | integračné testy backendu                                                                     |
| `pnpm verify`           | lint, typecheck, secretlint, unit testy a integračné testy; musí prejsť pred dokončením kroku |
| `pnpm test:e2e`         | E2E testy voči Docker stacku (Chromium a WebKit), nie je súčasťou `pnpm verify`               |

## Integračné testy backendu

Potrebujú bežiaci Postgres (`pnpm db:up`) a `TEST_DATABASE_URL` v `.env`.

- `globalSetup` overí, že názov DB končí na `_test` (inak testy okamžite skončia), nastaví `DATABASE_URL` na test DB (testy tak nikdy nepoužijú dev DB), DB vytvorí, ak neexistuje, a aplikuje migrácie (`prisma migrate deploy`).
- Pred každým testom sa vyprázdnia všetky tabuľky okrem `_prisma_migrations` (`TRUNCATE ... RESTART IDENTITY CASCADE`, zoznam z `pg_tables`).
- Súbory bežia sériovo (`fileParallelism: false`), lebo zdieľajú jednu DB.
- Testy nepoužívajú seed. Dáta si vytvárajú cez helpery v `backend/test/helpers/` (`createUser({ role })`, `createTestApp({ config, prisma })`).

## Unit testy frontendu

- Prostredie jsdom, setup v `frontend/src/test/setup.ts` (jest-dom matchery, i18n).
- Stránky sa renderujú cez router s pamäťovou históriou, keď záleží na routingu.
- `src/lib/i18n.test.ts` overuje, že každý `ERROR_CODE` a `VALIDATION_CODE` má preklad `sk` aj `en`. Nový kód bez prekladov test zhodí.

## E2E testy (Playwright)

Testy sú v `e2e/tests/`, pomocné moduly v `e2e/support/`, konfigurácia v `e2e/playwright.config.ts`. Bežia v prehliadačoch Chromium a WebKit voči produkčnému stacku na `http://localhost:8080`.

### Prvé spustenie

Prehliadače Playwrightu sa inštalujú zvlášť (raz na stroj, po zmene verzie `@playwright/test` znova):

```bash
pnpm --filter e2e exec playwright install chromium webkit
```

Potrebný je `.env` v roote (`SEED_ADMIN_PASSWORD`, `DATABASE_URL`) a admin zo seedu v lokálnej DB (`pnpm db:seed`).

### Spustenie

```bash
pnpm test:e2e                          # stack + všetky testy
pnpm test:e2e tests/login.spec.ts      # iba jeden súbor (argumenty idú do Playwrightu)
pnpm test:e2e --project=webkit         # iba jeden prehliadač
```

`pnpm test:e2e` (skript `scripts/test-e2e.sh`) najprv spustí Postgres, ak nebeží (`docker compose up -d --wait db`, bežiaci kontajner nereštartuje), potom znova vytvorí kontajnery `backend` a `frontend` (`docker compose up -d --build --wait --force-recreate --no-deps`) s `LOGIN_RATE_LIMIT_MAX=1000`, aby testy neskončili na 429, a potom spustí `pnpm --filter e2e test:e2e` (`playwright test`). Stack po testoch beží ďalej s limitom 1000; `pnpm stack:up` vráti hodnoty z `.env`.

Testy sa dajú pustiť aj priamo (`pnpm --filter e2e test:e2e`) proti už bežiacemu stacku. Jeden beh urobí približne 10 pokusov o prihlásenie, takže pri predvolenom limite 10 za 15 minút ďalší beh skončí na 429; vtedy použite `pnpm test:e2e`.

Iná adresa aplikácie (napr. dev mód počas písania testov) cez `E2E_BASE_URL`:

```bash
E2E_BASE_URL=http://localhost:5173 pnpm --filter e2e test:e2e
```

Krok je hotový, až keď testy prejdú voči stacku na `:8080`. Pri chybe ostane trace v `e2e/test-results/` (`pnpm --filter e2e exec playwright show-trace <cesta k trace.zip>`) a HTML report v `e2e/playwright-report/` (`pnpm --filter e2e exec playwright show-report`). Oba priečinky sú v `.gitignore`.

### Setup projekt a storageState

- Projekt `setup` (`tests/auth.setup.ts`) sa spustí pred projektmi `chromium` a `webkit`. Prihlási sa cez UI raz za každú rolu a uloží cookies a `localStorage` do `e2e/.auth/admin.json` a `e2e/.auth/editor.json` (v `.gitignore`).
- Projekt `teardown` (`tests/auth.teardown.ts`) je naviazaný na `setup` a spustí sa po dobehnutí všetkých testov, aj keď niektorý zlyhal. Zmaže z DB všetkých EDITORov s emailom `e2e-editor-%@example.com` (ich session sa zmažú kaskádou). Pri behu s filtrom (`--project`, cesta k súboru) beží tiež.
- Testy štandardne bežia ako ADMIN. Iná rola cez `test.use({ storageState: STORAGE_STATE.EDITOR })`, neprihlásený cez `test.use({ storageState: ANONYMOUS })` (`e2e/support/auth.ts`).
- Test, ktorý sa odhlasuje, sa musí prihlásiť sám (vlastný kontext bez `storageState`). Logout by inak zmazal zdieľanú session a ostatné testy by dostali 401.

### Testovacie dáta

- ADMIN je používateľ zo seedu, heslo `SEED_ADMIN_PASSWORD` z `.env`. `.env` načíta `e2e/support/env.ts` (`process.loadEnvFile`); premenné nastavené v shelli majú prednosť.
- EDITOR: vytváranie používateľov cez API príde až v míľniku C, preto ho testy zakladajú priamo v lokálnej DB (`DATABASE_URL`) cez `pg` a hash `argon2id` (`createEditor()` v `e2e/support/db.ts`). Email je unikátny (`e2e-editor-<timestamp>-<náhodný suffix>@example.com`), heslo sa generuje v kóde. Od míľnika C sa prepne na `POST /api/admin/users`.
- Testy nepredpokladajú prázdnu DB (DB zdieľa aj dev mód) a po sebe upracú iba svojich testovacích EDITORov (viď `teardown`).
- Kontroly v DB (zmazaný riadok `Session` po logoute, `lastLoginAt`) čítajú tú istú lokálnu DB cez `pg`.

### Čo testy pokrývajú (míľnik B)

| Súbor               | Čo overuje                                                                                                                                                                  |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `login.spec.ts`     | login a logout cez UI, zmazaná session a 401 so starou cookie, session po refreshi, preklad zlého hesla, email bez ohľadu na veľkosť písmen a `lastLoginAt`                 |
| `routing.spec.ts`   | presmerovania neprihláseného a prihláseného, menu podľa roly, 403 pre EDITORa na `/admin/users`, refresh na `/admin/users`, 404                                             |
| `language.spec.ts`  | prepínač SK/EN bez reloadu, voľba v `localStorage['locale']` prežije refresh                                                                                                |
| `fonts.spec.ts`     | žiadne požiadavky na Google Fonts, fonty sa načítajú z vlastnej domény                                                                                                      |
| `api-smoke.spec.ts` | iba v projekte `chromium` (nezávisí od prehliadača): `GET /api/health`, CSRF: POST bez `X-Requested-With` a s `application/x-www-form-urlencoded` vráti 403 `CSRF_REJECTED` |
