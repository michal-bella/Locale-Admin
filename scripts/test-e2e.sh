#!/usr/bin/env bash
# Runs the Playwright suite against the production stack on http://localhost:8080.
# Always (re)creates backend and frontend with a high login rate limit, so a stack started by `pnpm stack:up`
# with the default limit never makes E2E fail with 429. `pnpm stack:up` restores the values from .env.
source "$(dirname "$0")/lib.sh"
require_env_file

# db is started separately so --force-recreate (with --no-deps) never restarts Postgres.
docker compose up -d --wait db
LOGIN_RATE_LIMIT_MAX=1000 docker compose up -d --build --wait --force-recreate --no-deps backend frontend

pnpm --filter e2e test:e2e "$@"
