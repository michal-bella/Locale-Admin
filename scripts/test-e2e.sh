#!/usr/bin/env bash
# Runs the Playwright suite of the e2e package. Fails clearly until the suite exists (milestone B).
source "$(dirname "$0")/lib.sh"

if ! grep -q '"test:e2e"' e2e/package.json; then
	echo "No E2E tests yet: Playwright tests are added in milestone B (see docs/plans/phase-1.md)." >&2
	exit 1
fi

pnpm --filter e2e test:e2e "$@"
