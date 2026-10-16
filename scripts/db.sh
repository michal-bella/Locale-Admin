#!/usr/bin/env bash
# Local Postgres (Docker) and Prisma helpers. Usage: scripts/db.sh up|down|migrate|seed|reset
source "$(dirname "$0")/lib.sh"
require_env_file

case "${1:-}" in
	up) docker compose up -d --wait db ;;
	down) docker compose stop db ;;
	migrate) pnpm --filter backend db:migrate ;;
	seed) pnpm --filter backend db:seed ;;
	reset) pnpm --filter backend db:reset ;;
	*)
		echo "Usage: $0 up|down|migrate|seed|reset" >&2
		exit 2
		;;
esac
