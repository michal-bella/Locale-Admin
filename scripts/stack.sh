#!/usr/bin/env bash
# Production-like stack in Docker on http://localhost:8080. Usage: scripts/stack.sh up|down|logs [service]
source "$(dirname "$0")/lib.sh"
require_env_file

case "${1:-}" in
	up) docker compose up -d --build --wait ;;
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
