# Locale Admin

Admin application for managing translations in **projects**. This file is the entry point for every AI agent and tool working in this repo. Module rules live in the module's own `AGENTS.md`; step-by-step procedures live in skills.

Current plan: [`docs/plans/project-members.md`](docs/plans/project-members.md) (previous: [`docs/plans/translations-views.md`](docs/plans/translations-views.md)) (phase 1: [`docs/plans/phase-1.md`](docs/plans/phase-1.md)). Human documentation: [`docs/`](docs/README.md).

## Domain

| Term            | Meaning                                                                                                                                                                                                                                                                                                                                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Member          | A user with global role `EDITOR` ("Člen" in the UI). Sees and works only in the projects they are a member of. Created by an `ADMIN` on `/admin/users` with an internal password; there are no invitations and no organizations.                                                                                                                                                                             |
| Project         | One translation sheet (e.g. B2B admin, B2C iOS, B2C Android, web URLs). Listed on the index page `/`; settings and members under `/projects/$projectId`.                                                                                                                                                                                                                                                     |
| Project member  | A user in a project (`ProjectMember`). The creator of a project becomes one; only an `ADMIN` adds existing users to a project and removes them, a member sees the list and can leave (never the last one).                                                                                                                                                                                                   |
| Editor          | A person who edits translations in projects.                                                                                                                                                                                                                                                                                                                                                                 |
| Global role     | `ADMIN` (sees every project, manages users and project members) or `EDITOR` (a member). Stored on `User.role`.                                                                                                                                                                                                                                                                                               |
| Language        | Translation language of a project (`ProjectLanguage`) from a fixed catalog (`SUPPORTED_LANGUAGES`). Each project has exactly one base language.                                                                                                                                                                                                                                                              |
| Translation key | A key in a project (`TranslationKey`), unique per project + namespace + name, at most 2 000 UTF-8 bytes (`IMPORT_KEY_MAX_BYTES`). Path-like keys (`orders.empty.title`) are grouped by prefix; keys with spaces are sentences and are never split on dots. Created only by an import.                                                                                                                        |
| Namespace       | Name of the source JSON file of a key (`loc`, `paths`, …; CSV section `--loc--`), at most 100 characters. Must be preserved exactly for export.                                                                                                                                                                                                                                                              |
| Translation     | Value of a key in one project language (`Translation`). `null` or a missing row = untranslated; `""` is stored as `null`; the status (Preložené / Nepreložené) is derived from the value and never stored. A key (row) is translated only when every project language has a value (extended view); the compact view judges by the target language. Edited in the modal „Upraviť preklad“ opened from a cell. |
| Import          | Two-step CSV import into a project (`POST …/imports/preview`, then `POST …/imports` with the same file and a column → language mapping). A filled value overwrites, an empty one never clears a translation; keys missing from the file are kept.                                                                                                                                                            |
| Project role    | Administrator, Translator, Developer, Reviewer. Per project, not yet: every member has the same rights for now.                                                                                                                                                                                                                                                                                              |

There is no self-registration. An `ADMIN` creates every user (admin or member) on `/admin/users` and adds existing users to projects on the Members page of a project.

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
10. Commits follow Conventional Commits (skill `commit-messages`). The remote is `origin` (GitHub `michal-bella/Locale-Admin`). Push `main` only when the user asks; never push agent branches.
11. Supported OS: macOS and Linux only.

## Agents and workflow

Roles are defined in [`.agents/agents/`](.agents/agents/): `orchestrator`, `frontend-developer`, `backend-developer`, `e2e-tester`, `accessibility-reviewer`, `code-reviewer`. Feature flow: [`.agents/workflows/feature.md`](.agents/workflows/feature.md).

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
| `add-endpoint`         | adding or changing an `/api/*` endpoint end to end (contract, BE, tests, docs)                          |
| `add-page`             | adding a new screen or route in the SPA (lazy route, hooks, states, form modal, tests)                  |
| `docs-update`          | updating `docs/`                                                                                        |

## Tool adapters

`AGENTS.md`, `.agents/` and `scripts/` are the only source of truth. Tool folders (`CLAUDE.md`, `.claude/`, `.codex/`) are thin adapters that point here. See [README](README.md#ai-tools).
