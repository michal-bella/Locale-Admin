---
title: 'Verzie prekladov projektu – implementačný plán'
updated: 2026-10-22
notion_page_id:
---

# Verzie prekladov projektu

## Kontext

Tím pracuje v mesačných sprintoch (Notion „Release timeplan“). Pre každý sprint má aplikácia v kóde verziu (`Admin 2.45`), dátum **code freeze** (vývojári do neho dodajú nové kľúče do Locale Admin) a dátum **end of copy + translation** (externí editori do neho preklady dokončia a vývojári ich syncujú do release vetvy). Dnes Locale Admin verzie nepozná: zoznam prekladov je jedna hromada a export vráti všetko, teda aj kľúče pre budúci sprint, ktoré v release vetve ešte nemajú byť.

Tento plán pridáva do projektu **verzie prekladov**: pomenované časové okno s názvom zhodným s verziou v kóde a dvoma dátumami. Verzia sa zapisuje na kľúče a bunky, ktoré v nej vznikli alebo sa zmenili, zoznam prekladov ju má ako filter a export vie vrátiť stav projektu k verzii. Žiadne kopírovanie dát, žiadne vetvy ani zlučovanie: verzia je štítok.

Postup podľa `.agents/workflows/feature.md` na vetve `feature/translation-versions`. Po každom míľniku checkpoint (`pnpm verify`, `docs/`, commit, krátky report).

Mimo rozsahu (odložené, pozri „Nadväzujúce“): história a changelog zmien buniek, vrátenie importu, úprava alebo mazanie verzie.

### Požiadavky používateľa

- `ADMIN` vytvorí verziu projektu (názov, dátum začiatku, dátum konca), typicky pri importe.
- `ADMIN` môže verziu **upraviť** (názov aj dátumy) v modáli, napríklad po preklepe pri importe. Dátum konca musí byť väčší ako dátum začiatku.
- Ďalšie importy do existujúcej verzie sú bežné.
- Zoznam prekladov má filter Verzia a ukazuje editorovi, koľko dní ostáva do uzamknutia verzie. Export prevezme verziu z filtra.
- Projekt bez verzií funguje presne ako dnes; verzie sú voliteľné.

### Rozhodnutia

| #   | Rozhodnutie                                                                                                                                                                                                                                                                                      | Prečo                                                                                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Verzia je štítok** (`ProjectVersion`), nie kópia kľúčov a hodnôt. Kľúč nesie verziu, v ktorej vznikol; bunka verziu, v ktorej bola hodnota naposledy zapísaná.                                                                                                                                 | Zodpovedá release procesu (jedna vetva vývoja, release vetvy sa odrezávajú podľa dátumu). Vetvenie s kópiami a zlučovaním by znásobilo každý dopyt a vyžadovalo riešenie konfliktov, ktoré tím nepotrebuje.                            |
| 2   | Verzia má `GET`, `POST` a `PATCH` (`ADMIN` upraví názov aj dátumy), ale **žiadne `DELETE`**. Úprava nemení verziu na kľúčoch a bunkách, iba jej atribúty.                                                                                                                                       | Preklep v názve alebo dátume pri importe sa musí dať opraviť bez novej verzie. Zmazanie by muselo odpojiť kľúče a bunky, ktoré na verziu ukazujú; namiesto toho sa verzia opraví.                                                      |
| 3   | Dátumy sú **len dátumy** (`@db.Date`, v kontrakte `YYYY-MM-DD`), `endsAt > startsAt` (prísne), prekrývanie verzií je dovolené.                                                                                                                                                                   | V timeplane sa sprinty prekrývajú (sprint 11 začína pred koncom sprintu 10). Čas dňa nemá význam; okno s nulovou dĺžkou nedáva zmysel.                                                                                                 |
| 4   | **Aktuálna verzia** = verzia, do ktorej padá dnešok (dátum servera); pri prekryve tá s najneskorším `startsAt`. Odvodzuje sa, neukladá sa a neprepína.                                                                                                                                           | Žiadny stav navyše, ktorý by niekto zabudol prepnúť.                                                                                                                                                                                   |
| 5   | Zápis stanoví verziu takto: import podľa vybranej verzie v modali; úprava bunky a „Pridať kľúč“ podľa `versionId` v tele požiadavky (FE pošle verziu zapnutú vo filtri), bez neho **aktuálna verzia podľa dátumu**, bez verzií `null`. Nezmenená bunka si verziu ponechá.                       | Editor, ktorý si vyfiltroval verziu, pracuje v nej. Bez filtra je správna odpoveď „to, čo práve beží“. Verzia bunky hovorí „naposledy zmenené vo verzii“, preto ju nezmenený zápis nesmie prepísať.                                   |
| 6   | Filter **Verzia** v zozname = „zmeny vo verzii“: kľúče vzniknuté vo verzii alebo s aspoň jednou bunkou zmenenou vo verzii. Žiadny implicitný predvolený filter; select označí aktuálnu verziu. Pri zapnutom filtri (inak pri aktuálnej verzii) zoznam ukáže **odpočet**: „Verzia v2.45: ostáva 12 dní do uzamknutia“, od `endsAt` „Verzia v2.45 je uzamknutá“. | To je práca, ktorú majú editori do `endsAt` dokončiť; štatistiky nad filtrom ukážu, koľko chýba, odpočet koľko času. Predvolený filter by skryl zvyšok projektu a URL bez parametra by znamenala dve rôzne veci.                       |
| 7   | Export so zvolenou verziou vráti predvolene **celý stav projektu k verzii** (`versionScope = UP_TO`): kľúče bez verzie a kľúče verzií so `startsAt` najneskôr ako zvolená. Checkbox **Len zmeny tejto verzie** (`ONLY`) exportuje to isté, čo filter v zozname.                                  | Release vetva `v2.45` potrebuje kompletný súbor bez kľúčov z `v2.46`. Rozdiel pre ručné zlúčenie sa zíde zriedka.                                                                                                                      |
| 8   | Verzie sa vytvárajú jedným endpointom `POST …/versions`; import modal pri „Vytvoriť novú“ zavolá najprv tento endpoint a potom import s jej `versionId`.                                                                                                                                         | Kontrakt importu ostane malý; verzia vzniká aj bez importu (ručné kľúče).                                                                                                                                                              |
| 9   | Verzie majú vlastnú stránku `/projects/$projectSlug/versions` (zoznam + „Vytvoriť verziu“), odkaz v bočnom paneli projektu. Vidí ju každý člen, tlačidlo iba `ADMIN`.                                                                                                                            | Editori potrebujú vidieť termíny. Nastavenia projektu sú o projekte samom; verzie sú dáta ako jazyky a majú tiež vlastnú stránku.                                                                                                      |
| 10  | `TranslationKey.versionId` a `Translation.versionId` sú FK s `onDelete: Restrict`.                                                                                                                                                                                                               | Verzia sa nemaže (rozhodnutie 2); `Restrict` to vynúti aj mimo API. Zmazanie projektu ide kaskádou cez `Project`.                                                                                                                      |
| 11  | Stav verzie podľa dnešného dátumu: **Pripravuje sa** (pred `startsAt`), **Prebieha** (do `endsAt` vrátane), **Uzamknutá** (po `endsAt`). **Uzamknutá verzia blokuje zápisy** pre `EDITOR`: úprava bunky, nový kľúč a import s touto verziou vrátia 409 `PROJECT_VERSION_LOCKED`. `ADMIN` má výnimku (hotfix po termíne). Verzia bez filtra (aktuálna podľa dátumu) nie je nikdy uzamknutá. | Po „end of copy + translation“ vývojári preklady syncli; ďalšia zmena editora by sa do release vetvy nedostala a vyzerala by ako hotová. Admin opravu urobí vedome a syncne ju ručne.                                                 |

## Dátový model (nová migrácia `project_versions`)

```prisma
/// A named date window of a project matching a release of the code (`v2.45`). An ADMIN can rename it and move its dates; it is never deleted.
/// `startsAt`: developers deliver the keys by this day (code freeze); `endsAt`: editors finish the translations by this day and developers sync them.
model ProjectVersion {
  id          String   @id @default(uuid()) @db.Uuid
  projectId   String   @db.Uuid
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  name        String
  startsAt    DateTime @db.Date
  endsAt      DateTime @db.Date
  createdById String?  @db.Uuid
  createdBy   User?    @relation(fields: [createdById], references: [id], onDelete: SetNull)
  createdAt   DateTime @default(now())
  keys         TranslationKey[]
  translations Translation[]

  @@unique([projectId, name])
  @@index([projectId, startsAt(sort: Desc)])
}

model TranslationKey {
  …
  /// Version the key was created in (import or „Pridať kľúč“); `null` for projects without versions and for keys created before them.
  versionId String?         @db.Uuid
  version   ProjectVersion? @relation(fields: [versionId], references: [id], onDelete: Restrict)

  @@index([versionId])
}

model Translation {
  …
  /// Version in which the value was last written; an unchanged write keeps it.
  versionId String?         @db.Uuid
  version   ProjectVersion? @relation(fields: [versionId], references: [id], onDelete: Restrict)

  @@index([versionId])
}
```

`ACTIVITY_TYPE` dostane `VERSION_CREATED` a `VERSION_UPDATED` (Prisma aj `packages/shared`). Seed sa nemení (seed projekt je bez verzií); E2E si verzie vytvoria cez API.

## Kontrakty (`packages/shared`)

| Schéma                                        | Zmena                                                                                                                                                                                                                                                                                                           |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `projectVersions.ts` (nový)                   | `PROJECT_VERSION_NAME_MAX_LENGTH = 50`; `createProjectVersionRequestSchema` `{ name: trim, 1…50; startsAt, endsAt: z.iso.date() }` + `superRefine` `endsAt > startsAt` (issue na `endsAt`, kód `INVALID`); `updateProjectVersionRequestSchema` = to isté, všetky polia voliteľné, aspoň jedno (`endsAt > startsAt` sa overí na BE nad zlúčenými hodnotami, rovnaký kód); `projectVersionSchema` `{ id, name, startsAt, endsAt, state: 'UPCOMING' \| 'ACTIVE' \| 'LOCKED', isCurrent, createdAt, createdBy }`; `projectVersionsResponseSchema` `{ items }` zoradené podľa `startsAt` zostupne. |
| `errors.ts`                                   | `PROJECT_VERSION_NAME_TAKEN` (409), `PROJECT_VERSION_NOT_FOUND` (404, verzia nepatrí projektu; používa import, úprava bunky, nový kľúč, export), `PROJECT_VERSION_LOCKED` (409, zápis `EDITOR`a do verzie po `endsAt`).                                                                                                                                                                 |
| `translations.ts`                             | `translationsQuerySchema.versionId` (uuid, voliteľné); `translationListItemSchema.version: { id, name } \| null`; `translationsResponseSchema.versions` (zoznam verzií projektu pre select, ako `namespaces` a `editors`); `updateTranslationRequestSchema.versionId?`, `createTranslationKeyRequestSchema.versionId?` (uuid, voliteľné: bez neho aktuálna verzia podľa dátumu). |
| `imports.ts`                                  | `importRequestSchema.versionId: z.uuid().nullable().default(null)`; `importResultSchema.version: { id, name } \| null`. Preview sa nemení.                                                                                                                                                                       |
| `exports.ts`                                  | `exportQuerySchema.versionId?` a `versionScope: z.enum(['UP_TO', 'ONLY']).default('UP_TO')` (`versionScope` bez `versionId` je chyba validácie). Platí aj pre `exportCheckQuerySchema`.                                                                                                                         |
| `activity.ts`                                 | `VERSION_CREATED` `{ name, startsAt, endsAt }`; `VERSION_UPDATED` `{ name, changes: { name?, startsAt?, endsAt? } }` so starou a novou hodnotou zmenených polí (ako `PROJECT_UPDATED`); `KEYS_IMPORTED` payload dostane `versionName?: string`.                                                                                                                                                                                                         |

## Backend

| Súbor                                                                                   | Zmena                                                                                                                                                                                                                                                                                                                  |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `services/projectVersions.service.ts`, `controllers/projectVersions.controller.ts` (nové) | `listProjectVersions` (so `state` a `isCurrent`), `createProjectVersion` (P2002 → 409 `PROJECT_VERSION_NAME_TAKEN`, `recordActivity VERSION_CREATED`), `updateProjectVersion` (zlúči s uloženými hodnotami, overí `endsAt > startsAt`, 404 cudzia verzia, 409 názov, `VERSION_UPDATED` iba pri skutočnej zmene).                     |
| `lib/projectVersions.ts` (nový)                                                         | `resolveVersionId(tx, { projectId, versionId, role })`: `undefined` → aktuálna verzia podľa dnešného dátumu servera (alebo `null`), uuid → overí príslušnosť k projektu (inak 404 `PROJECT_VERSION_NOT_FOUND`) a pre inú rolu než `ADMIN` aj `endsAt >= dnes` (inak 409 `PROJECT_VERSION_LOCKED`). Volá sa pred každým zápisom s verziou.                                                                                                      |
| `routes/projects.routes.ts`                                                             | `GET /:projectId/versions` (`requireProjectAccess`), `POST /:projectId/versions` a `PATCH /:projectId/versions/:versionId` (`requireRole(ADMIN)`).                                                                                                                                                                      |
| `services/imports.service.ts`                                                           | `request.versionId` → `resolveVersionId` (len uuid alebo `null`, import aktuálnu neodhaduje); `INSERT INTO "TranslationKey"` a upsert buniek zapíšu `"versionId"`; `ON CONFLICT … DO UPDATE SET … "versionId" = EXCLUDED."versionId"` ostáva pod podmienkou `IS DISTINCT FROM`, takže nezmenená bunka si verziu nechá; `versionName` do `KEYS_IMPORTED`. |
| `services/translations.service.ts`                                                      | `updateTranslation`: `versionId` cez `resolveVersionId`, zapíše sa len keď sa hodnota zmenila; `createTranslationKey`: `versionId` na kľúč; zoznam: filter `versionId` (`k."versionId" = $1 OR EXISTS (SELECT 1 FROM "Translation" x WHERE x."keyId" = k.id AND x."versionId" = $1)`), `version` v položke, `versions` v odpovedi. |
| `services/exports.service.ts`                                                           | `rowBatches` dostane podmienku podľa `versionScope`: `UP_TO` → `k."versionId" IS NULL OR v."startsAt" <= $startsAt` (JOIN na verziu), `ONLY` → rovnaká podmienka ako filter v zozname. To isté v `checkExport`.                                                                                                       |
| Integračné testy                                                                        | `projectVersions.test.ts` (vytvorenie, 409, `endsAt <= startsAt`, úprava názvu a dátumov vrátane zlúčenej validácie, `state`, `isCurrent`, 403 pre `EDITOR`), rozšírenie `imports.test.ts`, `translations.test.ts`, `exports.test.ts` o verziu (zápis, filter, `UP_TO`/`ONLY`, 404 pre cudziu verziu, 409 `PROJECT_VERSION_LOCKED` pre `EDITOR` a priechod pre `ADMIN`).                                                                              |

## Frontend

| Súbor                                                                                   | Zmena                                                                                                                                                                                                                                                                                       |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `api/projectVersions.ts` + hooky                                                        | `useProjectVersions`, `useCreateProjectVersion`, `useUpdateProjectVersion` (`QUERY_KEYS.projectVersions`), po zápise invalidujú aj zoznam prekladov (názov verzie v chipoch a odpočte).                                                                                                      |
| `routes/projectVersionsRoute.ts` + `.lazy.ts`, `pages/ProjectVersionsPage`              | Lazy route `/projects/$projectSlug/versions` podľa skillu `add-page`: tabuľka (názov, začiatok, koniec, stav **Pripravuje sa / Prebieha / Uzamknutá**, vytvoril), prázdny stav s vysvetlením, tlačidlo **Vytvoriť verziu** a v riadku ikonové tlačidlo **Upraviť** (`ADMIN`, žiadne ⋯ menu). |
| `components/VersionFormModal`                                                           | Jeden formulár pre vytvorenie aj úpravu: názov + dva `DateInput` (Mantine dates), klientská kontrola `endsAt > startsAt`, serverové chyby (`PROJECT_VERSION_NAME_TAKEN`, `endsAt`). Používa ho stránka verzií (vytvoriť, upraviť) aj import (vytvoriť).                                       |
| `components/Sidebar`                                                                    | odkaz **Verzie** v navigácii projektu.                                                                                                                                                                                                                                                      |
| `components/ImportModal`                                                                | krok **Verzia** pred potvrdením (len keď projekt má aspoň jednu verziu alebo je používateľ `ADMIN`): select existujúcich verzií s predvolenou aktuálnou, možnosť **Bez verzie**, tlačidlo **Vytvoriť novú** otvorí `VersionFormModal`; `versionId` do požiadavky; výsledok ukáže názov verzie. |
| `routes/projectTranslationsRoute.ts`, `pages/TranslationsPage`                          | `version` vo `validateSearch`; select **Verzia** v toolbare (položky z `versions`, aktuálna označená „(aktuálna)“), chip aktívneho filtra, `clearFilters` ho zahrnie; **odpočet** nad tabuľkou pre verziu z filtra, inak pre aktuálnú verziu: „Verzia v2.45: ostáva 12 dní do uzamknutia“ (plurál, dnes = „ostáva posledný deň“), po `endsAt` „Verzia v2.45 je uzamknutá“, pred `startsAt` „začína o N dní“; počíta sa z `endsAt`/`startsAt` a dnešného dátumu v prehliadači; chip verzie pri kľúči v riadku; `EditTranslationModal` a `CreateKeyModal` posielajú `versionId` z filtra; pri uzamknutej verzii vo filtri `EDITOR` nemá úpravu bunky dostupnú (bunka sa neotvára, odpočet vysvetlí prečo), `ADMIN` áno; chyba `PROJECT_VERSION_LOCKED` sa prekladá ako každý kód. |
| `components/ExportModal`                                                                | keď je vo filtri verzia: riadok „Stav k verzii v2.45“ a checkbox **Len zmeny tejto verzie**; `versionId` + `versionScope` do query exportu aj kontroly.                                                                                                                                       |
| i18n `sk`, `en`, `cs`                                                                   | `versionsPage.*`, `versionFormModal.*`, `translationsPage.versionCountdown.*`, `translationsPage.filters.version*`, `importModal.version.*`, `exportModal.version.*`, chybové kódy.                                                                                                                                              |

Projekt bez verzií: stránka Verzie ukáže prázdny stav, zoznam prekladov select Verzia nezobrazí (`versions` je prázdne), import krok Verzia preskočí pre `EDITOR`; `ADMIN` ho vidí s možnosťou vytvoriť prvú.

## E2E a docs

- `versions.spec.ts` (nový): vytvorenie verzie, úprava názvu a dátumov, chyba pri `endsAt <= startsAt`, 409 pri duplicitnom názve, stav podľa dátumu, `EDITOR` bez tlačidiel.
- `import.spec.ts`: import do novej verzie, kľúče dostanú chip verzie; druhý import do tej istej verzie.
- `translations.spec.ts`: filter Verzia (`?version=`), odpočet dní do uzamknutia, úprava bunky pri zapnutom filtri zapíše verziu, `EDITOR` v uzamknutej verzii bunku neotvorí, Zrušiť filtre.
- `export.spec.ts`: export s verziou `UP_TO` neobsahuje kľúče neskoršej verzie; `ONLY` obsahuje len zmeny.
- `api-smoke.spec.ts`: `GET/POST …/versions`, 403, 404 cudzej verzie pri importe.
- `docs/api/project-versions.md` (nový), `docs/api/translations.md` (filter, `version`, `versions`), `docs/api/imports.md` (`versionId`), `docs/api/exports.md` (`versionId`, `versionScope`), `docs/database.md` (`ProjectVersion`, stĺpce), `docs/frontend.md` (stránka Verzie, filter, import a export), `docs/decisions/0006-project-versions.md` (verzia ako štítok, nie vetva), `docs/changelog.md`, `AGENTS.md` (doména: Verzia).

## Míľniky

| #   | Obsah                                                                                                                                                                   | Overenie                                                                                                      |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| A   | Migrácia `project_versions`, kontrakt verzií a chybové kódy, `GET/POST/PATCH …/versions`, `resolveVersionId`, `VERSION_CREATED`/`VERSION_UPDATED`, integračné testy, `docs/api/project-versions.md`, ADR 0006 | `pnpm verify`; api-smoke `POST …/versions` (201, 409, 400 `endsAt`), `PATCH` (200, 400, 403), `GET …/versions` ako `EDITOR` |
| B   | Zápis verzie: import (`versionId`), úprava bunky, nový kľúč; filter a `version`/`versions` v zozname; export `versionId` + `versionScope`; integračné testy; docs API    | `pnpm verify`; api-smoke import s verziou → `GET …/translations?versionId=` vráti jeho kľúče, export `UP_TO` vs `ONLY` |
| C   | FE: stránka Verzie, `VersionFormModal` (vytvoriť, upraviť), odkaz v bočnom paneli, hooky, unit testy, docs frontend                                                     | `pnpm verify`; v `pnpm dev` vytvorenie a úprava verzie, prázdny stav, `EDITOR` bez tlačidiel                 |
| D   | FE: krok Verzia v importe, filter, odpočet a chip v zozname, `versionId` z filtra v modáloch, export modal, unit testy                                                   | `pnpm verify`; v `pnpm dev` import `import-sample.csv` do verzie, filter, odpočet, export                      |
| E   | E2E (`versions.spec.ts`, rozšírenia), changelog, `AGENTS.md`                                                                                                             | `pnpm test:e2e tests/versions.spec.ts tests/import.spec.ts tests/translations.spec.ts tests/export.spec.ts`   |

## Otvorené otázky

1. Má mať názov verzie predpísaný tvar (`v2.45`, `2.45`), alebo stačí voľný text do 50 znakov? (Navrhujem voľný text, unikátny v projekte; tvar si určí tím.)
2. Má `UP_TO` pri rovnakom `startsAt` dvoch verzií zahrnúť obe? (Navrhujem áno, porovnáva sa iba `startsAt`.)
3. Má karta štatistík pri zapnutom filtri Verzia ukazovať počty nad filtrom namiesto celého projektu? Dnes `stats` filtre ignorujú. (Navrhujem ponechať správanie `stats`; odpočet vedľa seba ukáže aj `total` kľúčov vo verzii.)
## Nadväzujúce (mimo tohto plánu)

- **História a changelog prekladov**: append-only tabuľka verzií buniek, história v modáli úpravy, vrátenie importu. Analyzované 2026-10-21, beží výlučne v Postgres transakciách (bez Redis). Samostatný plán po tomto.
