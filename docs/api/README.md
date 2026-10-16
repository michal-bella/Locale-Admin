---
title: "API"
updated: 2026-10-16
notion_page_id:
---

# API

Všetky endpointy sú pod `/api`. Request a response schémy sú v `packages/shared`.

## Chybový kontrakt

Každá chyba má tvar `{ error: { code, message, details? } }`. Frontend zobrazuje iba preložený `code`, nikdy `message`.

Endpointy pribudnú v krokoch, v ktorých vzniknú.
