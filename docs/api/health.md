---
title: 'API: health'
updated: 2026-10-16
notion_page_id:
---

# GET /api/health

Stav backendu a databázy. Používa ho Docker healthcheck a smoke testy. Nevyžaduje prihlásenie a nič nemení.

Databáza sa overí dotazom `SELECT 1` s časovým limitom 2 sekundy.

## Odpoveď

Schéma `healthResponseSchema` v `packages/shared`.

| Pole           | Typ                 | Popis                                                |
| -------------- | ------------------- | ---------------------------------------------------- |
| `status`       | `ok` / `error`      | celkový stav, rovnaký ako stav databázy              |
| `version`      | string              | verzia backendu (ENV `APP_VERSION`, default `0.0.0`) |
| `db.status`    | `ok` / `error`      | stav databázy                                        |
| `db.latencyMs` | number alebo `null` | trvanie `SELECT 1` v ms, `null` pri chybe            |

| HTTP | Kedy                   |
| ---- | ---------------------- |
| 200  | databáza odpovedá      |
| 503  | databáza je nedostupná |

Príklad (200):

```json
{ "status": "ok", "version": "0.0.0", "db": { "status": "ok", "latencyMs": 1 } }
```

Príklad (503):

```json
{ "status": "error", "version": "0.0.0", "db": { "status": "error", "latencyMs": null } }
```
