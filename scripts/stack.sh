#!/usr/bin/env bash
# Production-like stack in Docker on http://localhost:8080. Usage: scripts/stack.sh up|down|logs [service]
source "$(dirname "$0")/lib.sh"
require_env_file

case "${1:-}" in
	up)
		# db separately with --no-recreate, see scripts/db.sh.
		docker compose up -d --wait --no-recreate db
		docker compose up -d --build --wait --no-deps backend frontend
		;;
	down) docker compose down ;;
	logs)
		shift
		docker compose logs -f --tail=200 "$@"
		;;
	*)
		echo "Usage: $0 up|down|logs [service]" >&2
		exit 2
		;;
esac
