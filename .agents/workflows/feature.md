# Workflow: feature

How a feature (or a plan step) moves from plan to merged code. The orchestrator drives it.

## 1. Plan

- Split the task into FE, BE and E2E work. Write down dependencies.
- Define the contract first: zod schemas, DTO types and error codes in `packages/shared`. Commit it on `main` before parallel work starts.

## 2. Parallel implementation

Each implementing role works in its own git worktree and branch created from `main`:

```bash
scripts/agents/worktree.sh create fe login      # -> ../locale-app-worktrees/fe-login on branch agent/fe-login
scripts/agents/worktree.sh create be login
```

The script copies `.env`, runs `pnpm install` and `prisma generate` (lint and typecheck need the generated client) and prints the **base commit** of the branch. Write the base into the task for the role; it is needed for every scope check. Roles commit to their branch. They do not run the full Docker stack or `pnpm dev` (ports would collide); unit and integration tests are fine.

## 3. Handoff

Each role ends with a short report:

- what changed (files, behavior)
- how it was verified (commands and results)
- what is open
- what it needs from the orchestrator (root or infra changes, new ENV variables)

## 4. Integration

```bash
scripts/agents/check-scope.sh frontend-developer <base> agent/fe-login
scripts/agents/check-scope.sh backend-developer <base> agent/be-login
git merge --no-ff --no-edit agent/fe-login
git merge --no-ff --no-edit agent/be-login
pnpm install && pnpm verify && pnpm stack:up
```

Use the base printed by `worktree.sh`, not `main`: once `main` moves (another branch merged first) or the branch is merged, `main...branch` no longer shows the branch's own changes. For an already merged branch the base is `$(git merge-base <merge-commit>^1 <branch>)`. An empty diff prints a warning, never treat it as a pass.

Keep git's default merge message (`Merge branch '…'`); commitlint ignores it, while a custom `merge: …` subject is rejected. Lockfile conflicts are resolved by re-running `pnpm install`, never by hand.

## 5. E2E

The E2E Tester runs smoke tests and Playwright against the stack and checks the acceptance criteria of the step.

## 6. Accessibility

When the step changes `frontend/`, the Accessibility Reviewer works in its own worktree created from the integrated `main` (`scripts/agents/worktree.sh create a11y <task>`). It checks the step's frontend diff against its checklist, fixes the gaps on `agent/a11y-<task>` and hands off. Before the review the orchestrator runs `pnpm test:e2e tests/accessibility.spec.ts` on the integrated step and passes the axe violations to the reviewer. After the handoff it runs `check-scope.sh accessibility-reviewer <base> agent/a11y-<task>`, merges and re-runs `pnpm verify` and the axe spec. Findings it could not fix go to the Frontend Developer or the orchestrator.

## 7. Review

The Code Reviewer reviews `git diff <step-base>...main` and re-runs `check-scope.sh` for every role branch with the bases from step 2. Findings go back to the role that owns the file; repeat 2–7 until no `high` findings are open and `medium` ones are fixed or deferred with a reason.

## 8. Documentation

The role that made a change updates the matching `docs/` page in the same branch. The Code Reviewer checks that `docs/` matches the code.

## 9. Checkpoint

The orchestrator removes the worktrees (`scripts/agents/worktree.sh remove fe login`), adds an entry to `docs/changelog.md` and reports to the user.
