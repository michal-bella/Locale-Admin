---
title: '0005: Tabuľka udalostí ActivityEvent pre aktivitu projektu'
updated: 2026-10-20
notion_page_id:
---

# 0005: Tabuľka udalostí ActivityEvent pre aktivitu projektu

## Kontext

Stránka Prehľad projektu ukazuje feed posledných zmien a graf dennej aktivity (plán `docs/plans/project-dashboard.md`). Dnes sa história nikde neukladá: `Translation.updatedAt` a `updatedById` držia iba poslednú zmenu bunky, import, jazyky ani členov nezaznamenáva nič.

Alternatívy:

- **Odhad z `Translation.updatedAt`**: bez novej tabuľky, ale staršie zmeny tej istej bunky sa stratia, import vyzerá ako stovky samostatných úprav a jazyky ani členovia v histórii nie sú.
- **Tabuľka udalostí zapisovaná v službách**: jedna udalosť za zmenu v tej istej transakcii, payload so snímkou údajov.
- **Databázové triggery**: zachytia aj zápisy mimo API, ale nepoznajú prihláseného používateľa a import by zapísal udalosť za každú bunku.

## Rozhodnutie

Tabuľka `ActivityEvent` (append-only), ktorú zapisuje helper `recordActivity(tx, …)` zo služieb v tej istej transakcii ako zmenu. Payload je snímka podľa `type` (diskriminovaná únia `activityEventDataSchema` v `packages/shared`), aby feed ostal čitateľný aj po zmazaní kľúča, jazyka alebo používateľa. `count` je počet zmenených prekladov a z neho sa ráta graf (import 90 prekladov = 90), feed ukáže import jedným riadkom. Udalosť sa zapíše iba pri skutočnej zmene (nezmenená hodnota prekladu ani nastavení nezapíše nič). Spätne sa doplnilo iba `PROJECT_CREATED` z `Project.createdAt`.

## Dôsledky

- Každá nová mutácia, ktorá má byť v aktivite, musí volať `recordActivity` vo svojej transakcii a mať typ v `ACTIVITY_TYPE` (Prisma aj `packages/shared`).
- História sa zbiera od nasadenia; staršie úpravy prekladov v grafe nie sú.
- Stará aj nová hodnota prekladu sa ukladá už teraz pre budúcu stránku Aktivita (porovnanie zmien).
- Retencia zatiaľ nie je (stovky až tisíce riadkov mesačne na projekt); zmazanie projektu zmaže jeho udalosti kaskádou.
