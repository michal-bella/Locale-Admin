# backend

Express 5 API. Owner: `backend-developer`. Details and examples: skills `backend-conventions` and `database-migrations`.

## Stack

Node 24, Express 5, TypeScript strict (ESM), Prisma 7 with `@prisma/adapter-pg`, PostgreSQL 17, pino, helmet, zod, Vitest + supertest.

## Structure (`src/`)

| Folder                   | Holds                                                                             |
| ------------------------ | --------------------------------------------------------------------------------- |
| `app.ts`                 | `createApp(config)`: builds the Express app from an explicit config, reads no ENV |
| `server.ts`              | entry point: validates ENV with zod, creates Prisma client and app, listens       |
| `config/`                | ENV schema and config type                                                        |
| `routes/`                | routers per area (`health`, `auth`, `admin`), mounted under `/api`                |
| `controllers/`           | request and response handling, input validation                                   |
| `services/`              | business logic and Prisma access                                                  |
| `middleware/`            | error handler, not-found, CSRF, auth, rate limit                                  |
| `lib/`                   | errors (`AppError`), logger, Prisma client factory                                |
| `prisma/` (package root) | `schema.prisma`, migrations, `seed.ts`                                            |
| `test/` (package root)   | integration tests, `globalSetup`, helpers                                         |

## Rules

- ENV is read and validated only in `server.ts` (and Prisma config / seed entry). Modules receive config as arguments.
- Every error response uses the shared contract: throw `AppError` with an `ERROR_CODE` from `@locale/shared`; the error middleware formats it. Unknown errors become 500 `INTERNAL_ERROR` and are logged.
- Request bodies are validated with schemas from `@locale/shared`. Never define request or response schemas here.
- Never return `passwordHash` or session tokens in a response.
- `GET` handlers never change domain state. `requireAuth` may refresh or delete the caller's own session row (sliding TTL, expiry).
- Protected routes use `createRequireAuth(prisma, config)` (and `requireRole(...)`); read the user with `getAuth(req)`. Never trust a user id from the body.
- Every `POST`/`PUT`/`PATCH`/`DELETE` passes the global CSRF middleware (JSON body + `X-Requested-With: XMLHttpRequest`); tests send `CSRF_HEADERS` from `test/helpers/auth.ts`.
- No CORS middleware (same origin via nginx or Vite proxy).
- Integration tests run against the `locale_test` database only (guard in `globalSetup`).
