---
title: 'Jazyky na úrovni projektu – implementačný plán'
updated: 2026-10-18
notion_page_id:
---

# Jazyky na úrovni projektu

## Kontext

Jazyky sú dnes globálne: tabuľka `Language` , admin ich spravuje na `/languages` a základný jazyk je jeden pre celý systém. Projekty majú mať vlastné jazyky: pri vytvorení projektu sa vyberú z katalógu, v projekte je stránka **Jazyky** so zoznamom priradených jazykov, kde sa dajú pridať ďalšie alebo odobrať. Admin stránka `/languages` zmizne.

Potvrdené rozhodnutia:
- Katalóg = `SUPPORTED_LANGUAGES` v `packages/shared/src/languages.ts` (9 jazykov), ten istý select ako dnes v **Pridať jazyk**.
- Každý projekt má vlastný základný jazyk; prvý pridaný je základný, mení sa v Nastaveniach projektu (select Základný jazyk). Globálny `isBase` zmizne.
- Nový projekt: aspoň jeden jazyk povinný, prvý vybraný je základný.
- Úprava názvov a vlajky (modál Nastavenia jazyka) sa vypúšťa: názvy a vlajka sa berú z katalógu.
- Pridať, odobrať jazyk a meniť základný môže člen projektu aj ADMIN (rovnako ako ostatné v projekte).

## Dátový model (migrácia `project_languages`)

```prisma
model ProjectLanguage {
  id        String   @id @default(uuid()) @db.Uuid
  projectId String   @db.Uuid
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  tag       String
  isBase    Boolean  @default(false)
  createdAt DateTime @default(now())

  @@unique([projectId, tag])
}
```
- Ručne v migrácii: čiastočný unikátny index `ProjectLanguage_projectId_isBase_key ON ("projectId") WHERE "isBase"` (najviac jeden základný na projekt, ako dnes `Language_isBase_key`).
- Dátová migrácia: každý existujúci projekt dostane kópiu dnešných globálnych jazykov aj s `isBase` (`INSERT … SELECT FROM "Project" CROSS JOIN "Language"`), potom `DROP TABLE "Language"`. Nič sa nestratí.
- Názvy a vlajka sa v DB neukladajú, mapuje ich backend z katalógu (`getSupportedLanguage`).
- Seed: `seedLanguages` zmizne; `seedProject` vytvorí seedovanému projektu `sk` (základný) a `en`.

## Kontrakt (`packages/shared`)

- `languages.ts`: ponechať katalóg, `languageSchema` (rovnaký tvar, teraz jazyk projektu), `languagesResponseSchema`, `createLanguageRequestSchema`. Odstrániť `updateLanguageRequestSchema`, `languageNameSchema`, `LANGUAGE_NAME_MAX_LENGTH`.
- `projects.ts`: `createProjectRequestSchema` + `languageTags: z.array(tag).min(1)` bez duplicít (`INVALID`).
- `projectSettings.ts`: `baseLanguageId` ostáva voliteľné, je to jazyk projektu.
- Chybové kódy `LANGUAGE_TAKEN`, `LANGUAGE_IS_BASE` sa ďalej používajú.

## API

| Metóda | Cesta | Popis |
|---|---|---|
| GET | `/api/projects/:projectId/languages` | jazyky projektu, základný prvý, potom podľa tagu |
| POST | `/api/projects/:projectId/languages` | `{ tag }`, prvý jazyk projektu je základný; 409 `LANGUAGE_TAKEN` |
| DELETE | `/api/projects/:projectId/languages/:languageId` | 204; 409 `LANGUAGE_IS_BASE`; 404 pre cudzí/neexistujúci |
| POST | `/api/projects` | navyše `languageTags`, projekt aj jazyky v jednej transakcii |
| PATCH | `/api/projects/:projectId/settings` | `baseLanguageId` musí byť jazyk tohto projektu (inak 400), meniť ho môže každý s prístupom (zruší sa 403 pre člena) |

Všetko za `requireProjectAccess`. Rušia sa `/api/languages` a `/api/admin/languages` (router, controller, service sa presunú do `projectLanguages.*`, `setBaseLanguage` s advisory zámkom per projekt).

## Frontend

- Zrušiť `/languages` (route, `LanguagesPage`, položka Jazyky v sekcii SPRÁVA), `LanguageSettingsModal` a hooky `api/languages/*` nahradiť `api/projectLanguages/*` (kľúč `QUERY_KEYS.PROJECTS.LANGUAGES(projectId)`).
- Nová route `/projects/$projectId/languages` → `ProjectLanguagesPage`: preložiť `LanguagesTable` (vlajka, anglický názov, pôvodný názov · tag, odznak Základný, `⋯` s **Odobrať jazyk**, pri základnom disabled s vysvetlením), `AddLanguageModal` (rovnaký select, už pridané disabled) a potvrdenie odobratia (`ConfirmDeleteModal` upravený na projekt).
- Sidebar v projekte: Nastavenia projektu, **Jazyky**, Členovia.
- `CreateProjectModal`: pole **Jazyky** – Mantine `MultiSelect` s vyhľadávaním a vlajkou, rovnaké položky ako select v Pridať jazyk (spoločná funkcia pre `data` a `renderOption`), povinné.
- `ProjectBasicsSection`: select Základný jazyk z jazykov projektu, aktívny pre všetkých; bez jazykov odkaz na stránku Jazyky projektu. Zmena základného invaliduje aj jazyky projektu.

## Testy a docs

- Backend: `adminLanguages.test.ts` → `projectLanguages.test.ts`; úpravy `projects.test.ts` (vytvorenie s jazykmi), `projectSettings.test.ts` (základný per projekt, člen ho mení), `seed.test.ts`.
- FE unit: `LanguagesPage.test` → `ProjectLanguagesPage.test`, `CreateProjectModal` s jazykmi, nastavenia, sidebar, guards.
- E2E: `languages.spec.ts` prepísať na jazyky projektu (vlastný testovací projekt, **odpadne globálny lock** aj `TEST_LANGUAGE` per prehliadač), `api-smoke`, `project-settings.spec` (základný jazyk bez locku), `projects.spec` (vytvorenie s jazykmi), `accessibility` (nová stránka namiesto `/languages`), helper `createProject` posiela `languageTags`.
- Docs: `docs/plans/project-languages.md`, `docs/api/admin-languages.md` → `docs/api/project-languages.md`, `docs/database.md` (model + ER), `docs/frontend.md`, `docs/testing.md`, `docs/overview.md`, `AGENTS.md` (Language), `changelog`.

## Postup a overenie

Vetva `feature/project-languages` z `main`.
1. Kontrakt + migrácia + seed → `pnpm db:migrate` na lokálnej DB (overiť, že projekty dostali bg/en/sk), `pnpm --filter @locale/shared test`.
2. Backend → `pnpm test:integration`.
3. Frontend → `pnpm --filter frontend test`, typecheck, build.
4. E2E + docs → `pnpm test:e2e`, `pnpm verify`.
5. Ručne na `:8080`: vytvoriť projekt s 2 jazykmi, na Jazykoch pridať a odobrať jazyk, základný nejde odobrať, zmeniť základný v nastaveniach, `/languages` je 404.
