---
name: testing
description: Where unit, integration and E2E tests live in Locale Admin, how to write them and how to run them (Vitest, supertest against the locale_test DB, Playwright against the Docker stack). Use when writing, running or debugging tests.
---

# Testing

Human docs: `docs/testing.md`.

| Kind                  | Where                              | Runner                                          | Command                             |
| --------------------- | ---------------------------------- | ----------------------------------------------- | ----------------------------------- |
| Unit (shared)         | `packages/shared/src/**/*.test.ts` | Vitest                                          | `pnpm --filter @locale/shared test` |
| Unit (backend)        | `backend/src/**/*.test.ts`         | Vitest                                          | `pnpm --filter backend test`        |
| Unit (frontend)       | `frontend/src/**/*.test.ts(x)`     | Vite+ (`vp test`, jsdom, Testing Library)       | `pnpm --filter frontend test`       |
| Integration (backend) | `backend/test/**/*.test.ts`        | Vitest + supertest, real Postgres `locale_test` | `pnpm test:integration`             |
| E2E / smoke           | `e2e/`                             | Playwright against `http://localhost:8080`      | `pnpm test:e2e`                     |

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
- `src/lib/i18n.test.ts` enforces that every `ERROR_CODE` and `VALIDATION_CODE` has `sk`, `cs` and `en` translations, that `sk.json`, `cs.json` and `en.json` have identical key sets, and that no value is empty.

## E2E (Playwright)

- `pnpm test:e2e` (`scripts/test-e2e.sh`): starts `db`, recreates `backend` and `frontend` with `LOGIN_RATE_LIMIT_MAX=1000`, then runs `playwright test` in `e2e/`. Prefer it over `pnpm --filter e2e test:e2e`: one run makes about 17 login attempts (setup 2; per browser 4 in `login.spec`, 1 in `users.spec` and 2 in `profile.spec`; 1 in `api-smoke.spec`, Chromium only), more than the default limit of 10 per 15 min, so a direct run against a stack with the default limit fails with 429.
- First time on a machine: `pnpm --filter e2e exec playwright install chromium webkit`.
- Projects: `setup` (`tests/auth.setup.ts`: UI login as ADMIN and a fresh EDITOR, saves `e2e/.auth/{admin,editor}.json`) → `chromium`, `webkit` → `teardown` (deletes `e2e-editor-%@example.com` users and `e2e-tmp-` projects). ADMIN storage state is the default; use `ANONYMOUS` from `support/auth.ts` for logged-out tests.
- The setup project logs in the ADMIN first, then creates the EDITOR as a member of a new test project (`createEditor` in `support/users.ts`, `POST /api/projects/:id/members`). Every user a test creates must use the `e2e-editor-` prefix (`TEST_USER_EMAIL_PREFIX`): the teardown deletes those users and the `e2e-tmp-` projects directly in the DB (there is no DELETE endpoint for them).
- Languages are per project now: tests create their own project (`createProject(api, label, languageTags)` in `support/projects.ts`, slug prefix `e2e-tmp-`, deleted by the teardown) and work with its languages (`listLanguages(api, projectId)` in `support/languages.ts`). No shared state, no lock. Select options are portalled: use `page.getByRole('option')`; the visible input of a Mantine MultiSelect is `[data-type="visible"]`.
- `getDatabaseUrl()` (`support/env.ts`) only accepts `localhost`, `127.0.0.1` or `::1`, so a shell override can never point the teardown at a remote DB.
- A test that logs out must log in on its own (`loginViaUi`), never with the shared storage state, or it kills the session of other tests.
- Selectors: roles and labels from `frontend/src/locales/sk.json` (e.g. `getByLabel('E-mail')`, `getByRole('button', { name: 'Menu používateľa' })`). In WebKit click the visible SK/EN text of the language switcher, not the hidden radio.
- Accessibility: `tests/accessibility.spec.ts` runs `@axe-core/playwright` (WCAG 2.2 AA tags) per screen in light and dark scheme. A new screen gets an entry in `SCREENS` with a `ready` wait for loaded data. `color-contrast` runs only in `test.fixme` tests until the design tokens meet AA (`docs/testing.md`).
- Dev mode: `E2E_BASE_URL=http://localhost:5173 pnpm --filter e2e test:e2e`; a step is done only against the stack. Failed tests keep a trace: `pnpm --filter e2e exec playwright show-trace <path>`.

## E2E rules

See `e2e/AGENTS.md`: run against the production stack, own unique test data, `storageState` per role, Chromium + WebKit.
