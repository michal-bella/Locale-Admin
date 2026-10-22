---
title: '0007: Verzia prekladov ako vlastná kópia kľúčov, nie štítok'
updated: 2026-10-22
notion_page_id:
---

# 0007: Verzia prekladov ako vlastná kópia kľúčov, nie štítok

Nahrádza [0006](./0006-project-versions.md).

## Kontext

Model štítkov z rozhodnutia 0006 (kľúč nesie verziu, v ktorej vznikol, bunka verziu, v ktorej bola naposledy zapísaná) sa pri skúšaní ukázal ako cudzí tomu, ako editori a vývojári s verziami pracujú: chceli vidieť **celú tabuľku prekladov verzie** (v2.44 má 2 300 kľúčov, v2.45 ich má 2 400), nie „prácu verzie“ ako filter nad jednou hromadou, a pohľad „celý projekt“ naprieč verziami im nedával zmysel. Export „stav k verzii“ navyše vracal aktuálne hodnoty, nie hodnoty z čias verzie. Plán: [`version-snapshots`](../plans/version-snapshots.md).

Alternatívy:

- **Štítok** (0006): bez kopírovania, ale bez skutočnej tabuľky verzie a bez hodnôt z čias verzie.
- **Kópia len zmien** (copy-on-write, verzia dedí z predchodcu, drží len vlastné bunky): úspornejšia a zmeny v staršej verzii sa samy prenášajú do novšej, ale dedenie treba rozriešiť v každom dopyte a správanie je pre tím ťažšie predvídateľné.
- **Plná kópia** (zvolené): každá verzia má vlastné kľúče a bunky pre všetky jazyky; pri 2 400 kľúčoch × 8 jazykoch je to ~20 000 riadkov na verziu, kópia pri importe je jeden `INSERT … SELECT`.

## Rozhodnutie

`TranslationKey.versionId` je povinné a kľúč je unikátny v rámci `(versionId, namespace, name)`; bunka patrí kľúču, teda verzii, a `Translation.versionId` zaniká. Verzia vzniká prázdna; naplní ju až import, ktorý definuje jej množinu kľúčov (kľúče chýbajúce v súbore z verzie zmizne) a preklady kľúčov prevezme z najbližšej staršej verzie podľa `startsAt`. Zápisy (úprava bunky, Pridať kľúč, import) idú vždy len do verzie, ktorej kľúč patrí, a nikdy sa nešíria do iných verzií: prekryv sprintov rieši disciplína (import novej verzie až po uzamknutí predchádzajúcej), spätné zmeny v staršej verzii robí `ADMIN`.

Zoznam prekladov, štatistiky, export, prehľad a upozornenia čítajú vždy jednu verziu (`versionId` je povinný parameter); pohľad „celý projekt“ zaniká. Diff verzie je porovnanie s predchodcom (pridané kľúče, zmenené bunky, odstránené kľúče) a je filtrom nad tabuľkou verzie, nie základným pohľadom. Pre editora je verzia mimo svojho okna (pred `startsAt` aj po `endsAt`) uzamknutá rovnako ako ručne zamknutá; `ADMIN` zapisuje vždy. Verziu, ktorá nie je aktuálna, môže `ADMIN` zmazať aj s dátami (`Cascade`). Jazyky ostávajú na projekte.

Existujúce dáta sa nekonvertujú: migrácia `version_snapshots` kľúče a bunky zmaže (aplikácia je vo vývoji), seed vytvorí demo projekt s dvoma verziami.

## Dôsledky

- Každý dopyt na kľúče ide cez `versionId`; projektové súhrny (zoznam projektov, stránka Jazyky) počítajú predvolenú verziu projektu (`findDefaultVersionId`: aktuálna podľa dátumu, inak najnovšia).
- Import a diff pracujú s „predchádzajúcou verziou“ odvodenou z `startsAt`; `ProjectVersion.importedAt` drží čas posledného importu (pre prázdnu verziu `null`) a neskôr poslúži na porovnanie spätných zmien.
- História hodnôt vzniká ako vedľajší efekt kópií (hodnota každej verzie ostáva); história v rámci jednej verzie a vrátenie importu ostávajú samostatnou témou.
- `resolveVersionId` (verzia z požiadavky alebo aktuálna podľa dátumu) nahradil `resolveVersion` (verzia povinná, kontrola príslušnosti a zámku).
