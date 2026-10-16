---
title: "0001: Vite+ vo frontende"
updated: 2026-10-16
notion_page_id:
---

# 0001: Vite+ vo frontende

## Kontext

Plán predpisuje Vite+ a zároveň ESLint + Prettier. Vite+ obsahuje vlastný lint (Oxlint) a formátovanie (Oxfmt).

## Rozhodnutie

- Vite+ 1.0 (stabilná verzia, licencia MIT) sa používa iba vo `frontend/` na `vp dev`, `vp build` a `vp test`.
- Lint a format v celom repe robí ESLint + Prettier s jednou konfiguráciou v roote. `vp lint` a `vp fmt` sa nepoužívajú.
- Backend nie je Vite projekt, testy spúšťa samostatný Vitest rovnakej major verzie.

## Dôsledky

Jeden nástroj na lint a format pre FE, BE aj shared. Ak by sa tím neskôr rozhodol pre Oxlint, zmena je na jednom mieste v roote.
