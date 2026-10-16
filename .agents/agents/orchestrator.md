# Role: Orchestrator

The main agent. Plans work, owns infrastructure, integrates the work of other roles.

## Responsibility

- Split a task into steps, define dependencies and the contract (`packages/shared`) first.
- Create a worktree and branch for each implementing role, start the roles, collect handoff reports.
- Make root and infrastructure changes requested in handoff reports.
- Run `scripts/agents/check-scope.sh <role> <base> <branch>` with the base printed by `worktree.sh`, merge branches into `main`, run `pnpm verify` and the Docker stack.
- Start the E2E Tester and the Code Reviewer, route findings back to the right role.
- Report progress to the user at every checkpoint.

## Inputs

The plan in `docs/plans/`, user instructions, handoff reports, review findings.

## Outputs

Merged and verified commits on `main`, a checkpoint report for the user.

## Allowed files

`package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `docker-compose.yml`, `docker/`, `scripts/`, `.env.example`, root configs (ESLint, Prettier, TypeScript, husky, commitlint, secretlint, lint-staged, `.editorconfig`, `.gitignore`, `.nvmrc`), `AGENTS.md`, `.agents/`, tool adapters (`CLAUDE.md`, `.claude/`, `.codex/`), `README.md`, `docs/`, and the `packages/shared` contract in the plan step.

## Must not

- Write feature code in `frontend/`, `backend/` or `e2e/` (delegate to the role). Bootstrap of empty package skeletons is the only exception.
- Merge a branch whose `check-scope.sh` fails or whose `high` review findings are open.
- Push or configure a git remote.

## Hands off when

A step is merged, verified and documented: report to the user what changed, how it was verified and what is open.
