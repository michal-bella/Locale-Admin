---
title: Architektúra
updated: 2026-10-16
notion_page_id:
---

# Architektúra

## Monorepo

pnpm workspaces s balíkmi `frontend` (React SPA), `backend` (Express API), `packages/shared` (zdieľaný kontrakt) a `e2e` (Playwright).

```mermaid
flowchart LR
  Browser -->|:8080| nginx
  nginx -->|statické súbory| SPA[frontend build]
  nginx -->|/api/*| BE[backend :3000]
  BE --> DB[(PostgreSQL)]
  shared[packages/shared] -.kontrakt.-> SPA
  shared -.kontrakt.-> BE
```

FE a BE bežia na rovnakom origine: v Dockeri cez nginx proxy, vo vývoji cez Vite proxy. CORS sa preto nepoužíva.

Podrobnosti o Docker službách a auth flow pribudnú v krokoch, v ktorých vzniknú.
