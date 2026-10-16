---
name: database-migrations
description: Change the Prisma schema, create and apply migrations, run or change the seed, reset the local database. Use whenever backend/prisma/ or the data model changes.
---

# Database migrations (Prisma 7, PostgreSQL 17)

Files: `backend/prisma/schema.prisma`, `backend/prisma/migrations/`, `backend/prisma/seed.ts` (entry) → `backend/src/services/seed.service.ts` (logic), `backend/prisma.config.ts`. Human docs: `docs/database.md` (update it with every model change).

## Prisma 7 specifics

- Generator `prisma-client` with output `backend/src/generated/prisma` (gitignored). Import the client from `src/lib/prisma.ts`, never from `@prisma/client` directly.
- Connection goes through the driver adapter `@prisma/adapter-pg` (`createPrismaClient(databaseUrl)` in `src/lib/prisma.ts`).
- Prisma does not load `.env` automatically. `prisma.config.ts` loads `../.env` if it exists; scripts use `--env-file-if-exists=../.env`.
- `prisma generate` runs as part of `dev`, `build`, `typecheck` and `test:integration`. After pulling schema changes run `pnpm --filter backend prisma:generate`.

## Workflow for a schema change

1. Edit `schema.prisma`.
2. `pnpm db:up` (if not running), then `pnpm --filter backend exec prisma migrate dev --name <snake_case_change>`. This creates the SQL migration, applies it to the dev DB and regenerates the client.
3. Review the generated SQL in `prisma/migrations/<timestamp>_<name>/migration.sql` (destructive changes need the user's OK).
4. Update `docs/database.md` (table + Mermaid ER diagram).
5. Run `pnpm --filter backend test:integration` (globalSetup applies migrations to `locale_test` with `prisma migrate deploy`).

Never edit an applied migration; add a new one. Production-like environments (Docker) only run `prisma migrate deploy` on start (`start:prod`).

## Seed

- Idempotent: creates the admin `michal.bella@goodrequest.com` (role `ADMIN`) with `SEED_ADMIN_PASSWORD` if missing; never changes an existing admin.
- `SEED_ADMIN_PASSWORD` is validated with `passwordSchema` from `@locale/shared`; missing or invalid → exit 1 with a clear message (value never printed).
- Run: `pnpm db:seed` (dev), automatically in `pnpm db:migrate` / `pnpm db:reset`, and in the backend container on every start (`node dist/seed.js`).

## Commands

| Command                                            | What                                                    |
| -------------------------------------------------- | ------------------------------------------------------- |
| `pnpm db:migrate`                                  | `prisma migrate dev` + seed on the dev DB               |
| `pnpm db:seed`                                     | seed only                                               |
| `pnpm db:reset`                                    | drop dev DB, re-apply all migrations, seed (local only) |
| `pnpm --filter backend exec prisma migrate status` | show applied/pending migrations                         |
| `pnpm --filter backend exec prisma studio`         | browse the dev DB                                       |
