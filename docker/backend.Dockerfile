# syntax=docker/dockerfile:1
FROM node:24.21.0-bookworm-slim AS base
# Side-effects cache off: a cached @prisma/engines postinstall could carry an engine for the wrong OpenSSL.
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH HUSKY=0 npm_config_side_effects_cache=false
# Prisma picks its schema engine by the OpenSSL version at install time, so build and runtime need the same OpenSSL.
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /repo

FROM base AS build
# Prisma config reads DATABASE_URL even for `prisma generate`; the real value is provided at runtime.
ARG DATABASE_URL=postgresql://build:build@localhost:5432/build
ENV DATABASE_URL=$DATABASE_URL
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY backend/package.json backend/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --filter backend...
COPY packages/shared packages/shared
COPY backend backend
RUN pnpm --filter backend build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm deploy --filter backend --prod --legacy /out
# Make sure the schema engine for this image's platform and OpenSSL is present (runtime files are read-only).
RUN cd /out && node_modules/.bin/prisma version >/dev/null

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
# Files stay owned by root, so the app user cannot modify its own code.
COPY --from=build /out ./
COPY docker/backend-entrypoint.sh /usr/local/bin/backend-entrypoint
USER node
EXPOSE 3000
CMD ["backend-entrypoint"]
