# syntax=docker/dockerfile:1
FROM node:24.21.0-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH HUSKY=0
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

FROM base AS runtime
ENV NODE_ENV=production
# Prisma's schema engine (used by `prisma migrate deploy`) needs OpenSSL.
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 3000
CMD ["npm", "run", "start:prod"]
