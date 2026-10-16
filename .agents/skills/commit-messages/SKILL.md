---
name: commit-messages
description: How to write commit messages in this repo (Conventional Commits enforced by commitlint). Use whenever creating a git commit.
---

# Commit messages

Format (enforced by `commitlint` with `@commitlint/config-conventional` in the `commit-msg` hook):

```
<type>(<optional scope>): <subject in imperative, lower case, no period>

<optional body: what changed and why>
```

| Type           | Use for                                           |
| -------------- | ------------------------------------------------- |
| `feat`         | new user-facing functionality                     |
| `fix`          | bug fix                                           |
| `docs`         | documentation only (`docs/`, `AGENTS.md`, skills) |
| `test`         | tests only                                        |
| `refactor`     | code change without behavior change               |
| `chore`        | tooling, config, dependencies, scaffolding        |
| `build` / `ci` | build system, Docker / CI                         |

Scopes (optional): `frontend`, `backend`, `shared`, `e2e`, `docker`, `harness`.

Examples:

```
feat(backend): add GET /api/health with database status
chore: add ESLint, Prettier and git hooks
docs(harness): describe worktree workflow
```

## Rules

- Hooks: `pre-commit` runs lint-staged (secretlint, ESLint `--fix`, Prettier on staged files). `commit-msg` runs commitlint. Never bypass them with `--no-verify`.
- If `pre-commit` fails, fix the cause and commit again; do not amend someone else's commit.
- Stage files explicitly (`git add <paths>`). Avoid `git add -A` when the worktree contains unrelated changes.
- AI agents end the message with a `Co-Authored-By:` trailer for the model.
- Never push. The repo has no remote until the user adds one.
