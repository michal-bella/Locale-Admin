#!/usr/bin/env bash
# Creates or removes a git worktree for an agent role.
# Usage: scripts/agents/worktree.sh create|remove <fe|be|e2e> <task>
set -euo pipefail

action="${1:-}"
kind="${2:-}"
task="${3:-}"

if [[ -z "$action" || -z "$kind" || -z "$task" ]]; then
	echo "Usage: $0 create|remove <fe|be|e2e> <task>" >&2
	exit 2
fi

repo_root="$(git rev-parse --show-toplevel)"
worktrees_dir="$(dirname "$repo_root")/locale-app-worktrees"
branch="agent/$kind-$task"
path="$worktrees_dir/$kind-$task"

case "$action" in
	create)
		mkdir -p "$worktrees_dir"
		base="$(git -C "$repo_root" rev-parse --short main)"
		git -C "$repo_root" worktree add -b "$branch" "$path" main
		if [[ -f "$repo_root/.env" ]]; then
			cp "$repo_root/.env" "$path/.env"
		fi
		(cd "$path" && pnpm install --frozen-lockfile && pnpm --filter backend prisma:generate >/dev/null)
		echo "Worktree ready: $path (branch $branch, base $base)"
		echo "Scope check: scripts/agents/check-scope.sh <role> $base $branch"
		;;
	remove)
		# No --force: git refuses when the worktree has uncommitted changes, so no work is lost silently.
		if ! git -C "$repo_root" worktree remove "$path"; then
			git -C "$path" status --short >&2
			echo "Worktree has uncommitted changes. Commit or discard them, then run remove again." >&2
			exit 1
		fi
		echo "Worktree removed: $path (branch $branch kept)"
		;;
	*)
		echo "Unknown action: $action" >&2
		exit 2
		;;
esac
