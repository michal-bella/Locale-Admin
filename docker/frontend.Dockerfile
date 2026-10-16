# syntax=docker/dockerfile:1
FROM node:24.21.0-bookworm-slim AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH HUSKY=0
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY frontend/package.json frontend/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --filter frontend...
COPY packages/shared packages/shared
COPY frontend frontend
RUN pnpm --filter frontend build

FROM nginx:1.30.6-alpine3.24 AS runtime
COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/frontend/dist /usr/share/nginx/html
EXPOSE 80
