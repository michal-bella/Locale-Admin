---
name: add-endpoint
description: Step-by-step recipe for adding a new REST endpoint to Locale Admin end to end (shared zod contract, Express route/controller/service, auth and role guard, integration tests, API docs, smoke test). Use when a task adds or changes an /api/* endpoint.
---

# Add an endpoint

Written from how `GET`/`POST /api/admin/users` was built (milestone C). Rules: `backend/AGENTS.md`, skill `backend-conventions`. Example files are the admin users ones.

## 1. Contract first (`packages/shared`, committed on `main` before FE/BE work)

- New file per area, e.g. `src/adminUsers.ts`, exported from `src/index.ts`.
- Request schema reuses shared pieces (`emailSchema`, `passwordSchema`) so FE form and BE validation are the same; leave out fields the client must not set (no `role` in `createUserRequestSchema`, zod strips unknown keys).
- Response schema lists exactly the returned fields (never `passwordHash`); dates as `z.iso.datetime()` strings. Lists are wrapped (`{ users: [...] }`) to leave room for paging.
- Every schema exports its `z.infer` type. New `ERROR_CODE` / `VALIDATION_CODE` values need `sk` and `en` translations (unit test enforces it).
- Unit test in `src/<area>.test.ts`: normalization, `toValidationIssues` codes and params, stripped fields.

```bash
pnpm --filter @locale/shared test && pnpm lint && pnpm typecheck
```

## 2. Backend

| File                                   | Content                                                                                                                                                                          |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/services/<area>.service.ts`       | Prisma calls with an explicit `select`, mapping to the shared type (`toAdminUser`), domain errors as `AppError(status, ERROR_CODE.X, 'English message')`                         |
| `src/controllers/<area>.controller.ts` | factory `create<Action>Controller(prisma)`: `schema.parse(req.body)` (a `ZodError` becomes 400 `VALIDATION_ERROR` with `details` in `error.middleware`), status code, typed body |
| `src/routes/<area>.routes.ts`          | `Router()` wiring only                                                                                                                                                           |
| `src/app.ts`                           | `app.use('/api/<prefix>', ...)` **before** `app.use('/api', notFoundMiddleware)`                                                                                                 |

- Auth: guard on the router, not per handler. ADMIN-only areas go under `src/routes/admin.routes.ts`, which already applies `createRequireAuth(prisma, config)` + `requireRole(ROLE.ADMIN)`; mount the new sub-router there (`router.use('/users', ...)`).
- Unique fields: no pre-check, catch `Prisma.PrismaClientKnownRequestError` with `code === 'P2002'` and throw the 409 code (covers concurrent requests).
- Passwords: `hashPassword` from `src/lib/password.ts` (argon2id), set `passwordChangedAt`.
- Mutations get CSRF protection from the global middleware; nothing to add.

## 3. Integration tests (`backend/test/<area>.test.ts`)

Helpers in `backend/test/helpers/` (`createUser({ role, createdAt })`, `loginAs(app, { email, password })`). Cover at least: success shape (`toEqual` on the exact body, no extra fields), sort order, 400 `details` per field with `params`, 409, 401 without session, 403 `FORBIDDEN` for the wrong role (GET and POST), 403 `CSRF_REJECTED` without `X-Requested-With`, and that the result is usable (e.g. the created user can log in).

```bash
pnpm --filter backend typecheck && pnpm --filter backend test && pnpm --filter backend test:integration
```

There is no per-package `lint` script; run root `pnpm lint`.

## 4. Docs

- `docs/api/<area>.md` (frontmatter, request, responses, every error code, curl example) and a row in `docs/api/README.md`. Skill `docs-update`.

## 5. Smoke against the stack

After merge: `pnpm stack:up`, then the curl recipe for the endpoint from skill `api-smoke` (401, 403, 400, 409, success). Delete smoke data afterwards (see `api-smoke`).
