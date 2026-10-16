#!/usr/bin/env bash
# Shared helpers for scripts/*.sh.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

require_env_file() {
	if [[ ! -f .env ]]; then
		echo "Missing .env. Run: cp .env.example .env" >&2
		exit 1
	fi
}
