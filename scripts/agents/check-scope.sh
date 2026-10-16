#!/usr/bin/env bash
# Fails when a role's branch changes files outside the role's allowed paths.
# Usage: scripts/agents/check-scope.sh <role> <base> [head]
# <base> must be the commit the branch was created from. After a merge use: "$(git merge-base <merge-commit>^1 <branch>)".
set -euo pipefail

role="${1:-}"
base="${2:-}"
head="${3:-HEAD}"

if [[ -z "$role" || -z "$base" ]]; then
	echo "Usage: $0 <role> <base> [head]" >&2
	echo "Roles: frontend-developer backend-developer e2e-tester code-reviewer" >&2
	exit 2
fi

case "$role" in
	frontend-developer) allowed=('frontend/' 'packages/shared/' 'docs/' 'pnpm-lock.yaml') ;;
	backend-developer) allowed=('backend/' 'packages/shared/' 'docs/' 'pnpm-lock.yaml') ;;
	e2e-tester) allowed=('e2e/' 'docs/testing.md' 'pnpm-lock.yaml') ;;
	code-reviewer) allowed=() ;;
	*)
		echo "Unknown role: $role" >&2
		exit 2
		;;
esac

for ref in "$base" "$head"; do
	if ! git rev-parse --verify --quiet "$ref^{commit}" >/dev/null; then
		echo "check-scope: unknown git ref '$ref'" >&2
		exit 2
	fi
done

# --no-renames lists both the old and the new path, so moving a file out of a forbidden path is caught too.
# Captured first so that a failing git diff aborts the script (set -e does not see failures in process substitution).
changed="$(git diff --name-only --no-renames "$base...$head")"

if [[ -z "$changed" ]]; then
	echo "check-scope: WARNING no changes in $base...$head (wrong base, or the branch is already merged?)" >&2
	exit 0
fi

violations=()
while IFS= read -r file; do
	ok=false
	for prefix in "${allowed[@]+"${allowed[@]}"}"; do
		if [[ "$file" == "$prefix" || "$file" == "$prefix"* && "$prefix" == */ ]]; then
			ok=true
			break
		fi
	done
	$ok || violations+=("$file")
done <<<"$changed"

if ((${#violations[@]} > 0)); then
	echo "check-scope: role '$role' changed files outside its allowed paths ($base...$head):" >&2
	printf '  %s\n' "${violations[@]}" >&2
	exit 1
fi

echo "check-scope: OK ($role, $base...$head)"
