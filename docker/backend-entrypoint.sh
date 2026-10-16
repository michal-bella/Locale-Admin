#!/bin/sh
# Migrate, seed, then replace the shell with node so it receives SIGTERM from `docker stop`.
set -e
node_modules/.bin/prisma migrate deploy
node dist/seed.js
exec node dist/server.js
