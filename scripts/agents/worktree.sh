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
		git -C "$repo_root" worktree add -b "$branch" "$path" main
		if [[ -f "$repo_root/.env" ]]; then
			cp "$repo_root/.env" "$path/.env"
		fi
		(cd "$path" && pnpm install --frozen-lockfile)
		echo "Worktree ready: $path (branch $branch)"
		;;
	remove)
		git -C "$repo_root" worktree remove --force "$path"
		echo "Worktree removed: $path (branch $branch kept)"
		;;
	*)
		echo "Unknown action: $action" >&2
		exit 2
		;;
esac
