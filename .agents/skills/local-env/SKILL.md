---
name: local-env
description: Start, stop, inspect and debug the local environment of Locale Admin (dev mode and the Docker production stack), query the local Postgres, insert ad-hoc test data, and work in agent git worktrees. Use for any "run the app", "check the stack", "logs", "DB", "port in use", "health check" or worktree task.
---

# Local environment

Human-facing docs: `docs/local-development.md`. All commands from the repo root. Requires `.env` (`cp .env.example .env`).

## Modes

|       | Dev mode                                               | Production stack                                                  |
| ----- | ------------------------------------------------------ | ----------------------------------------------------------------- |
| Start | `pnpm db:up && pnpm db:migrate && pnpm dev`            | `pnpm stack:up` (db `--no-recreate`, then backend + frontend)     |
| URLs  | FE `http://localhost:5173`, BE `http://localhost:3000` | `http://localhost:8080` (nginx), BE debug `http://localhost:3001` |
| Stop  | Ctrl+C, `pnpm db:down`                                 | `pnpm stack:down`                                                 |

Both modes share the same Postgres (`localhost:5433`, DB `locale`). Ports do not collide, both can run at once.

Every checkout (main and git worktrees) uses compose project `locale-admin`, so one `locale-admin-db-1`. Its config hash differs per checkout (bind mount path), so a plain `docker compose up db` (or `up` of the whole stack) from another checkout recreates it and kills Postgres mid-run (`57P03`). `pnpm db:up`, `stack:up` and `test:e2e` use `--no-recreate` for `db`; never run `docker compose up` for `db` without it. To apply a `db` config change on purpose: `docker compose up -d --wait --force-recreate db` (volume keeps the data).

## Status and logs

```bash
docker compose ps                                   # state + (healthy)
pnpm stack:logs backend                             # follow logs (db | backend | frontend)
curl -s http://localhost:8080/api/health            # FE → nginx → BE → DB
curl -s http://localhost:3001/api/health            # BE container directly
curl -s http://localhost:5173/api/health            # dev: Vite proxy → BE
```

`/api/health` returns `{"status":"ok","version":"…","db":{"status":"ok","latencyMs":1}}` (200) or `status: "error"` (503) when the DB is down.

Rebuild one service after code changes: `docker compose up -d --build --wait backend`. Reset the DB volume (deletes all local data): `docker compose down -v` then `pnpm stack:up` or `pnpm db:up && pnpm db:migrate`.

## Local database (ONLY local, never any other DB)

```bash
docker compose exec -T db psql -U locale -d locale -c 'select email, role, "isActive" from "User";'
docker compose exec db psql -U locale -d locale          # interactive
docker compose exec -T db psql -U locale -d locale_test -c '\dt'
```

Sessions of a user: `select "userId", "createdAt", "lastUsedAt", "expiresAt" from "Session";` (only the token hash is stored).

Prisma model names are quoted PascalCase tables (`"User"`, `"Session"`), columns camelCase (`"passwordHash"`). Insert ad-hoc data through the app or seed helpers where possible; raw SQL inserts must provide `id` (UUID, `gen_random_uuid()`), `"updatedAt"` and an argon2 hash for `"passwordHash"`.

## Troubleshooting

| Symptom                                                             | Fix                                                                                                                                                                       |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Missing .env`                                                      | `cp .env.example .env`                                                                                                                                                    |
| port 5433 / 3000 / 5173 / 8080 in use                               | `lsof -i :<port>`; change `DB_PORT` (and both DB URLs) in `.env` or stop the other process                                                                                |
| `stack:up` hangs at backend                                         | `pnpm stack:logs backend`: ENV validation error names the variable; migration or DB connection errors follow                                                              |
| BE exits `Invalid environment variables: SEED_ADMIN_PASSWORD`       | set it in `.env` (min. 8 chars)                                                                                                                                           |
| deep link like `/admin/users` returns nginx 404                     | check `try_files … /index.html` in `docker/nginx/default.conf`                                                                                                            |
| `/api/*` returns 502 via `:8080`                                    | backend container not healthy: `docker compose ps`, logs                                                                                                                  |
| integration tests: database `locale_test` missing                   | `globalSetup` creates it; check `TEST_DATABASE_URL` ends with `_test`                                                                                                     |
| Prisma warns about OpenSSL in Docker                                | runtime image must `apt-get install openssl` (see `docker/backend.Dockerfile`)                                                                                            |
| login succeeds (200) but the next request is 401 / back on `/login` | the browser dropped the cookie: over http `COOKIE_SECURE` must be `false` in `.env` (Safari, WebKit drop `Secure` cookies on http)                                        |
| tests fail with `57P03` / bursts of 500                             | another checkout recreated db: compare `docker inspect locale-admin-db-1 --format '{{.State.StartedAt}}'`; `docker events --filter container=locale-admin-db-1` shows who |
| login returns 429 `RATE_LIMITED`                                    | wait `Retry-After` seconds or `docker compose up -d --force-recreate backend` (in-memory limiter); `pnpm test:e2e` runs with `LOGIN_RATE_LIMIT_MAX=1000`                  |

## Agent worktrees

```bash
scripts/agents/worktree.sh create be <task>   # ../locale-app-worktrees/be-<task>, branch agent/be-<task>, copies .env, pnpm install
scripts/agents/worktree.sh remove be <task>   # removes the worktree, keeps the branch
```

In a worktree: run unit and integration tests, never `pnpm dev` or the Docker stack (ports collide with other agents). The orchestrator runs the stack in the main worktree after merging.
