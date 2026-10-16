---
title: 'Testovanie'
updated: 2026-10-16
notion_page_id:
---

# Testovanie

Unit testy (Vitest), integračné testy BE (Vitest + supertest voči test DB) a E2E testy (Playwright voči produkčnému stacku). Príkazy pribudnú v krokoch, v ktorých testy vzniknú.

## Backend

| Príkaz (z rootu)                         | Čo spustí                                                   |
| ---------------------------------------- | ----------------------------------------------------------- |
| `pnpm --filter backend test`             | unit testy (`backend/src/**/*.test.ts`), bez DB             |
| `pnpm --filter backend test:integration` | integračné testy (`backend/test/**/*.test.ts`) voči test DB |

Integračné testy potrebujú bežiaci Postgres (`pnpm db:up`) a `TEST_DATABASE_URL` v `.env`.

- `globalSetup` overí, že názov DB končí na `_test` (inak testy okamžite skončia), DB vytvorí, ak neexistuje, a aplikuje migrácie (`prisma migrate deploy`).
- Pred každým testom sa vyprázdnia všetky tabuľky okrem `_prisma_migrations` (`TRUNCATE ... RESTART IDENTITY CASCADE`, zoznam z `pg_tables`).
- Súbory bežia sériovo (`fileParallelism: false`), lebo zdieľajú jednu DB.
- Testy nepoužívajú seed. Dáta si vytvárajú cez helpery v `backend/test/helpers/` (`createUser({ role })`, `createTestApp()`).
