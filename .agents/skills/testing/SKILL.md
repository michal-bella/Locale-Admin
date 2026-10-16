---
name: testing
description: Where unit, integration and E2E tests live in Locale Admin, how to write them and how to run them (Vitest, supertest against the locale_test DB, Playwright against the Docker stack). Use when writing, running or debugging tests.
---

# Testing

Human docs: `docs/testing.md`.

| Kind                  | Where                              | Runner                                          | Command                                |
| --------------------- | ---------------------------------- | ----------------------------------------------- | -------------------------------------- |
| Unit (shared)         | `packages/shared/src/**/*.test.ts` | Vitest                                          | `pnpm --filter @locale/shared test`    |
| Unit (backend)        | `backend/src/**/*.test.ts`         | Vitest                                          | `pnpm --filter backend test`           |
| Unit (frontend)       | `frontend/src/**/*.test.ts(x)`     | Vite+ (`vp test`, jsdom, Testing Library)       | `pnpm --filter frontend test`          |
| Integration (backend) | `backend/test/**/*.test.ts`        | Vitest + supertest, real Postgres `locale_test` | `pnpm test:integration`                |
| E2E / smoke           | `e2e/`                             | Playwright against `http://localhost:8080`      | `pnpm test:e2e` (added in milestone B) |

`pnpm test` runs all unit tests; `pnpm verify` runs lint, typecheck, secretlint, unit and integration tests.

## Backend integration tests

- Need the dev Postgres running (`pnpm db:up`) and `TEST_DATABASE_URL` in `.env`.
- `test/globalSetup.ts`: aborts unless the DB name ends with `_test`, creates the DB if missing, runs `prisma migrate deploy`, passes the URL to tests.
- `test/setup.ts`: before each test truncates every table except `_prisma_migrations` (`RESTART IDENTITY CASCADE`). Tests never depend on seed data.
- Files run serially (`fileParallelism: false`).
- Build the app with `createTestApp({ config, prisma })` from `test/helpers/app.ts` (override config per test, e.g. a low rate limit). Create data with helpers in `test/helpers/` (`createUser({ role })`).

```ts
import request from 'supertest'
import { createTestApp } from './helpers/app'

it('returns 404 in the error contract', async () => {
	const res = await request(createTestApp()).get('/api/xyz')
	expect(res.status).toBe(404)
	expect(res.body.error.code).toBe('NOT_FOUND')
})
```

## Frontend unit tests

- jsdom environment, setup in `src/test/setup.ts` (jest-dom matchers, i18n).
- Render pages through the router with a memory history (`createAppRouter({ history })`) when routing matters.
- `src/lib/i18n.test.ts` enforces that every `ERROR_CODE` and `VALIDATION_CODE` has `sk` and `en` translations; adding a code without translations fails the test.

## E2E rules

See `e2e/AGENTS.md`: run against the production stack, own unique test data, `storageState` per role, Chromium + WebKit.
