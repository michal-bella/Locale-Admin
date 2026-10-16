---
title: '0002: TanStack Router'
updated: 2026-10-16
notion_page_id:
---

# 0002: TanStack Router

## Kontext

Plán necháva na výber React Router alebo TanStack Router.

## Rozhodnutie

TanStack Router s routami definovanými v kóde (code-based).

- Typovo bezpečné cesty, parametre a odkazy.
- `beforeLoad` guardy sa priamo napoja na TanStack Query (`ensureQueryData` pre `/api/auth/me`), takže presmerovanie pri 401 a 403 je na jednom mieste.
- Routy v kóde namiesto file-based: aplikácia má málo rout a odpadá generovaný súbor aj ďalší Vite plugin.

## Dôsledky

Pri väčšom počte rout sa dá prejsť na file-based routing bez zmeny API komponentov.
