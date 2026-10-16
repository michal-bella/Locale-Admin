# Locale Admin

Admin application for managing translations of **organizations** and their **projects**. This file is the entry point for every AI agent and tool working in this repo. Module rules live in the module's own `AGENTS.md`; step-by-step procedures live in skills.

Current plan: [`docs/plans/phase-1.md`](docs/plans/phase-1.md). Human documentation: [`docs/`](docs/README.md).

## Domain

| Term         | Meaning                                                                                            |
| ------------ | -------------------------------------------------------------------------------------------------- |
| Organization | A customer. Has many projects.                                                                     |
| Project      | One translation sheet (e.g. B2B admin, B2C iOS, B2C Android, web URLs).                            |
| Editor       | A person who edits translations in projects.                                                       |
| Global role  | `ADMIN` (manages users) or `EDITOR`. Stored on `User.role`.                                        |
| Project role | Administrator, Translator, Developer, Reviewer. Per project, comes with projects (not in phase 1). |

There is no self-registration. Only an `ADMIN` creates users.

## Repository layout

| Path               | What                                                              | Rules                                                    |
| ------------------ | ----------------------------------------------------------------- | -------------------------------------------------------- |
| `frontend/`        | React SPA (Vite+, Mantine, Tailwind, TanStack Router + Query)     | [`frontend/AGENTS.md`](frontend/AGENTS.md)               |
| `backend/`         | Express 5 API, Prisma, PostgreSQL                                 | [`backend/AGENTS.md`](backend/AGENTS.md)                 |
| `packages/shared/` | zod schemas, DTO types, error codes shared by FE and BE           | [`packages/shared/AGENTS.md`](packages/shared/AGENTS.md) |
| `e2e/`             | Playwright E2E and smoke tests                                    | [`e2e/AGENTS.md`](e2e/AGENTS.md)                         |
| `docker/`          | Dockerfiles, nginx config, Postgres init scripts                  |                                                          |
| `scripts/`         | environment, DB and agent helper scripts (bash)                   |                                                          |
| `docs/`            | human documentation (Slovak, synced to Notion later)              | skill `docs-update`                                      |
| `.agents/`         | agent roles, skills, workflows (source of truth for all AI tools) |                                                          |

## Commands

Run from the repo root. Package manager is **pnpm** only (never npm or yarn).

| Command                                                              | What                                                                                |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `pnpm dev`                                                           | FE (`:5173`) + BE (`:3000`) locally with hot reload. Needs `pnpm db:up`             |
| `pnpm db:up` / `db:down`                                             | Postgres in Docker                                                                  |
| `pnpm db:migrate` / `db:seed` / `db:reset`                           | Prisma migrate dev + seed / seed only / drop, migrate, seed                         |
| `pnpm stack:up` / `stack:down` / `stack:logs [service]`              | production stack in Docker on `http://localhost:8080`                               |
| `pnpm lint` / `typecheck` / `test` / `test:integration` / `test:e2e` | checks                                                                              |
| `pnpm verify`                                                        | lint + typecheck + secretlint + unit + integration. Must pass before a step is done |

## Hard rules

1. Never commit secrets. Real values only in `.env` (gitignored). `.env.example` holds local-only values.
2. FE and BE contracts (request/response, error codes, validation) live only in `packages/shared`. Never duplicate a schema.
3. API errors use the contract `{ error: { code, message, details? } }`. FE shows only translated `code`, never `message`.
4. Every user-facing text goes through i18n (`sk` default, `en`). No hardcoded strings in components.
5. Never change files outside your role's ownership (see `.agents/agents/`). Ask the orchestrator in the handoff report instead.
6. Never touch the reference project `~/REPOS/Notino-Landing-Monorepo` except for reading.
7. Verify current library docs (Context7 or official docs) before using an API you have not used in this repo yet.
8. When something is unclear or contradicts the plan, stop and ask. Do not guess silently.
9. Update `docs/` in the same step as the code change (skill `docs-update`).
10. Commits follow Conventional Commits (skill `commit-messages`). Never push; no remote is configured.
11. Supported OS: macOS and Linux only.

## Agents and workflow

Roles are defined in [`.agents/agents/`](.agents/agents/): `orchestrator`, `frontend-developer`, `backend-developer`, `e2e-tester`, `code-reviewer`. Feature flow: [`.agents/workflows/feature.md`](.agents/workflows/feature.md).

## Skills

Skills live in [`.agents/skills/`](.agents/skills/) (Agent Skills format). A skill exists only when it contains real, verified commands for this repo.

| Skill                  | Use when                                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------- |
| `project-standards`    | lint, format, typecheck, naming, secrets check                                                          |
| `commit-messages`      | writing a commit                                                                                        |
| `local-env`            | starting, stopping, inspecting or debugging the local environment or local DB; working in git worktrees |
| `database-migrations`  | changing the Prisma schema, migrations, seed                                                            |
| `testing`              | writing or running unit, integration or E2E tests                                                       |
| `backend-conventions`  | writing backend code                                                                                    |
| `frontend-conventions` | writing frontend code                                                                                   |
| `figma-to-code`        | implementing a Figma design                                                                             |
| `api-smoke`            | smoke testing the API with curl                                                                         |
| `docs-update`          | updating `docs/`                                                                                        |

## Tool adapters

`AGENTS.md`, `.agents/` and `scripts/` are the only source of truth. Tool folders (`CLAUDE.md`, `.claude/`, `.codex/`) are thin adapters that point here. See [README](README.md#ai-tools).
