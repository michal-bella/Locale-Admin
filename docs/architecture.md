---
title: 'Architektúra'
updated: 2026-10-16
notion_page_id:
---

# Architektúra

## Monorepo

pnpm workspaces:

| Balík                                | Obsah                                                                         |
| ------------------------------------ | ----------------------------------------------------------------------------- |
| `frontend`                           | React SPA (Vite+, Mantine, Tailwind, TanStack Router a Query, react-i18next)  |
| `backend`                            | Express 5 API, Prisma 7, PostgreSQL                                           |
| `packages/shared` (`@locale/shared`) | zdieľaný kontrakt: zod schémy, typy, chybové a validačné kódy, pravidlá hesla |
| `e2e`                                | Playwright testy voči produkčnému stacku                                      |

FE a BE nikdy nedefinujú vlastné schémy požiadaviek a odpovedí, iba ich importujú z `@locale/shared`.

## Komunikácia

```mermaid
flowchart LR
  Browser -->|:8080| nginx
  nginx -->|statické súbory| SPA[frontend build]
  nginx -->|/api/*| BE[backend :3000]
  BE --> DB[(PostgreSQL)]
  shared[packages/shared] -.kontrakt.-> SPA
  shared -.kontrakt.-> BE
```

FE a BE bežia na rovnakom origine: v Dockeri cez nginx proxy, vo vývoji cez Vite proxy. CORS sa preto nepoužíva. Axios na FE má `baseURL: '/api'`.

## Docker služby

| Služba     | Image                                                              | Port na hoste      | Healthcheck                 |
| ---------- | ------------------------------------------------------------------ | ------------------ | --------------------------- |
| `db`       | `postgres:17-alpine`                                               | `5433` (`DB_PORT`) | `pg_isready`                |
| `backend`  | `docker/backend.Dockerfile` (Node 24, multi-stage)                 | `3001` (iba debug) | `GET /api/health` vráti 200 |
| `frontend` | `docker/frontend.Dockerfile` (build cez Vite+, runtime nginx 1.30) | `8080`             | nginx vráti `index.html`    |

- Backend pri štarte spustí `prisma migrate deploy`, idempotentný seed a server (`docker/backend-entrypoint.sh`, server dostane SIGTERM a korektne sa ukončí). Beží ako používateľ `node`, súbory aplikácie patria `root` a nedajú sa meniť.
- Porty `5433` (DB) a `3001` (BE) sú naviazané iba na `127.0.0.1`.
- nginx proxuje `/api/*` na `backend:3000` s hlavičkami `X-Forwarded-*` (Express má `trust proxy 1`), statické assety cachuje natrvalo a pre ostatné cesty vracia `index.html` (SPA fallback).
- Služby štartujú v poradí `db` → `backend` → `frontend`, každá čaká na zelený healthcheck predchádzajúcej.
- V kontajneri compose prepisuje `DATABASE_URL` na host `db`, lokálny `.env` ukazuje na `localhost:5433`.

## Auth flow

Prihlásenie, session v DB a CSRF ochrana pribudnú v míľniku B (plán: [phase-1.md](./plans/phase-1.md)).
