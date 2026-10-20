#!/usr/bin/env bash
# Local Postgres (Docker) and Prisma helpers. Usage: scripts/db.sh up|down|migrate|seed|reset
source "$(dirname "$0")/lib.sh"
require_env_file

case "${1:-}" in
	# --no-recreate: the db config hash differs per checkout (bind mount path), so a plain up from a
	# worktree would recreate the Postgres another checkout is using.
	up) docker compose up -d --wait --no-recreate db ;;
	down) docker compose stop db ;;
	migrate) pnpm --filter backend db:migrate ;;
	seed) pnpm --filter backend db:seed ;;
	reset) pnpm --filter backend db:reset ;;
	*)
		echo "Usage: $0 up|down|migrate|seed|reset" >&2
		exit 2
		;;
esac
