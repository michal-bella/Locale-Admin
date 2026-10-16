---
name: backend-conventions
description: How backend code in Locale Admin is structured and written (Express 5 layers, createApp(config, deps), ENV validation, error contract, logging, auth rules). Use when adding or changing anything in backend/src.
---

# Backend conventions

Module rules: `backend/AGENTS.md`. API docs for humans: `docs/api/`.

## Layers

`routes/` (wiring) → `controllers/` (HTTP in/out, validation) → `services/` (logic, Prisma). Files are named `<area>.<layer>.ts`. Factories receive dependencies explicitly; nothing reads globals or `process.env`.

```ts
// routes/health.routes.ts
export const createHealthRouter = (prisma: PrismaClient, appVersion: string): Router => {
	const router = Router()
	router.get('/', createHealthController(prisma, appVersion))
	return router
}

// controllers/health.controller.ts
export const createHealthController =
	(prisma: PrismaClient, appVersion: string): RequestHandler =>
	async (_req, res) => {
		const db = await checkDatabase(prisma)
		const body: HealthResponse = { status: db.status, version: appVersion, db }
		res.status(db.status === HEALTH_STATUS.OK ? 200 : 503).json(body)
	}
```

Mount new routers in `src/app.ts` under `/api/<area>` **before** `app.use('/api', notFoundMiddleware)`.

## App and config

- `src/server.ts` is the only place that reads `process.env`: it parses `envSchema` (`src/config/env.ts`), creates the Prisma client and logger, calls `createApp(config, { prisma, logger })` and listens. It handles SIGTERM/SIGINT.
- `createApp` must stay pure so integration tests can build it with a custom config (`createTestApp({ config })`). New settings (e.g. rate limit, cookie flags) go into `envSchema` + `Config` + `TEST_CONFIG`, and the variable into `.env.example`, `docker-compose.yml` and `docs/local-development.md` (orchestrator-owned files: request them in the handoff).
- `trust proxy` is `1` (exactly one proxy hop: nginx or Vite).

## Validation and errors

- Validate bodies with schemas from `@locale/shared` (`schema.parse(req.body)`); the error middleware turns a `ZodError` into 400 `VALIDATION_ERROR` with `details` from `toValidationIssues`.
- Throw `new AppError(status, ERROR_CODE.X, 'English message for logs')` for expected errors. Never send `res.status(...).json({ error })` by hand.
- Unknown errors become 500 `INTERNAL_ERROR`; the stack is logged, never returned.
- Express 5 forwards rejected promises from async handlers to the error middleware; no try/catch wrappers needed.

## Auth

- Protect a route with `createRequireAuth(prisma, config)` and, for roles, `requireRole(ROLE.ADMIN)` (`src/middleware/auth.middleware.ts`). Read the user with `getAuth(req)`; it is an `AuthUser` from `@locale/shared`.

```ts
router.get('/', createRequireAuth(prisma, config), requireRole(ROLE.ADMIN), createListUsersController(prisma))
```

- Session logic lives in `services/session.service.ts` (token + SHA-256 hash, sliding TTL, `SESSION_TOUCH_INTERVAL_MS` = 5 min, absolute limit); cookie helpers in `lib/sessionCookie.ts` (`locale_session`). Never set the cookie by hand.
- The global CSRF middleware (`middleware/csrf.middleware.ts`) runs before `express.json()`; new mutations need nothing extra. Integration tests send `CSRF_HEADERS` and log in with `loginAs(app, { email, password })` from `test/helpers/auth.ts`.
- The login rate limiter is created per router (`middleware/rateLimit.middleware.ts`), so every `createTestApp` has its own in-memory store. `TEST_CONFIG.loginRateLimitMax` is high; override it per test.

## Security rules

- Never return `passwordHash`, session tokens or their hashes. Map Prisma rows to response DTOs from `@locale/shared`.
- Passwords: argon2id via `src/lib/password.ts`.
- `GET` handlers never mutate state (CSRF model relies on it).
- No CORS middleware.
- Logging: pino via `pino-http`. Before adding auth, configure `redact` for `req.headers.cookie` and `res.headers["set-cookie"]`.

## Build and run

`pnpm --filter backend dev` (tsx watch), `build` (tsdown → `dist/server.js`, `dist/seed.js`, bundles `@locale/shared` and the Prisma client), `start:prod` (migrate deploy + seed + server). Docker runs the same steps through `docker/backend-entrypoint.sh`, which `exec`s node so `docker stop` (SIGTERM) reaches the server's shutdown handler.
