---
title: 'Testovanie'
updated: 2026-10-16
notion_page_id:
---

# Testovanie

Unit testy (Vitest, vo frontende Vite+), integračné testy backendu (Vitest + supertest voči test DB `locale_test`). E2E testy (Playwright voči produkčnému Docker stacku) pribudnú v míľniku B.

## Druhy testov

| Druh            | Kde                                | Nástroj                                           | Príkaz (z rootu)                    |
| --------------- | ---------------------------------- | ------------------------------------------------- | ----------------------------------- |
| Unit (shared)   | `packages/shared/src/**/*.test.ts` | Vitest                                            | `pnpm --filter @locale/shared test` |
| Unit (backend)  | `backend/src/**/*.test.ts`         | Vitest, bez DB                                    | `pnpm --filter backend test`        |
| Unit (frontend) | `frontend/src/**/*.test.ts(x)`     | Vite+ (`vp test`, jsdom, Testing Library)         | `pnpm --filter frontend test`       |
| Integračné (BE) | `backend/test/**/*.test.ts`        | Vitest + supertest, reálny Postgres `locale_test` | `pnpm test:integration`             |
| E2E / smoke     | `e2e/`                             | Playwright voči `http://localhost:8080`           | `pnpm test:e2e` (od míľnika B)      |

## Súhrnné príkazy

| Príkaz                  | Čo spustí                                                                                     |
| ----------------------- | --------------------------------------------------------------------------------------------- |
| `pnpm test`             | všetky unit testy (shared, backend, frontend)                                                 |
| `pnpm test:integration` | integračné testy backendu                                                                     |
| `pnpm verify`           | lint, typecheck, secretlint, unit testy a integračné testy; musí prejsť pred dokončením kroku |

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
