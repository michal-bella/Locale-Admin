---
title: 'Správa projektov (admin) – implementačný plán (MVP)'
updated: 2026-10-18
notion_page_id:
---

# Správa projektov (admin) – implementačný plán (MVP)

Nová stránka **Projekty** v sekcii SPRÁVA, kde ADMIN vidí **všetky projekty** v tabuľke, môže ich **upraviť** v modale (obsah stránky `/projects/$projectId/settings`) a **zmazať**. Postup podľa `.agents/workflows/feature.md` na vetve `feature/admin-projects`: kontrakt v `packages/shared`, potom BE a FE paralelne vo vlastných worktree, E2E, review. Po každom kroku checkpoint (`pnpm verify`, `docs/`, commit, krátky report).

## Predpoklady

- **Iba ADMIN.** EDITOR stránku nevidí (bez položky v sidebari, route vráti 403, API 403 cez `requireRole(ROLE.ADMIN)`).
- **Mazanie je tvrdé.** `ProjectMember` a `ProjectLanguage` majú `onDelete: Cascade`, takže stačí `prisma.project.delete`. Používatelia ostávajú (aj keď im nezostane žiadny projekt). Keď pribudnú preklady, musia mať tiež `onDelete: Cascade` na `Project`.
- **Úprava = existujúci formulár.** Modal znovu použije `ProjectSettingsForm` a `PATCH /api/projects/:projectId/settings` (ADMIN má prístup ku každému projektu cez `requireProjectAccess`). Nový endpoint na úpravu netreba.
- **Index `/` sa nemení.** ADMIN tam ďalej vidí všetky projekty ako karty; nová stránka je správcovský pohľad (tabuľka, počty, mazanie).

## Rozsah

| Prvok                                                                                                   | MVP                                                 |
| ------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Položka **Projekty** v `Sidebar` v sekcii SPRÁVA (nad Používateľmi), iba ADMIN                          | áno                                                 |
| `PageIntro` (eyebrow „Správa“, nadpis „Projekty“, popis)                                                | áno                                                 |
| Tabuľka: farba + názov, slug, základný jazyk, počet jazykov, počet členov, vytvorený                    | áno                                                 |
| Akcie v riadku (menu `DotsHorizontal`): **Upraviť**, **Otvoriť projekt**, **Zmazať**                    | áno                                                 |
| Modal **Upraviť projekt** s formulárom nastavení (názov, slug, farba, základný jazyk, ochrana premenných) | áno                                                 |
| Modal **Zmazať projekt** s potvrdením                                                                   | áno, potvrdenie prepísaním slugu                    |
| Vytvorenie projektu z tejto stránky                                                                     | áno, tlačidlo otvorí existujúci `CreateProjectModal` |
| Vyhľadávanie, stránkovanie, hromadné mazanie, archivácia                                                | **nie**                                             |
| Správa jazykov a členov v modale                                                                        | **nie**, odkaz „Otvoriť projekt“ vedie na stránky projektu |

## Rozhodnutia

- **Route:** `/admin/projects` pod `appLayoutRoute`, guard `beforeLoad` na `ROLE.ADMIN` a `errorComponent: RouteError` v eager súbore, stránka lazy (`adminProjectsRoute.ts` + `.lazy.ts`) presne ako `adminUsersRoute`.
- **Modal je lokálny stav stránky** (`editingProjectId`), nie route. Deep link na úpravu existuje už ako `/projects/$projectId/settings`.
- **Formulár v modale:** `ProjectSettingsForm` dostane voliteľné props `onSaved` (modal sa po úspešnom uložení zavrie) a `onCancel` (zobrazí tlačidlo Zrušiť namiesto „Opustiť projekt“). V modale sa posiela `isMember={false}`, takže „Opustiť projekt“ sa nezobrazí. Stránka nastavení sa správa rovnako ako doteraz.
- **Modal `EditProjectModal`** (`components/EditProjectModal/`): `AppModal` (size ~720), načíta `useProjectSettingsQuery(id)` a `useProjectLanguagesQuery(id)`; loading = skeletony, chyba = text + Skúsiť znova (ako `ProjectSettingsPage`). Počas uloženia sa nedá zavrieť (`isPending`).
- **Modal `DeleteProjectModal`** (`components/DeleteProjectModal/`) podľa `RemoveMemberModal`/`ConfirmDeleteModal`: text s názvom projektu a dopadmi (zmaže sa N jazykov a odoberie N členov), `TextInput` na prepísanie slugu, červené tlačidlo aktívne až pri zhode. 404 pri mazaní = projekt už neexistuje → notifikácia + obnovenie zoznamu.
- **Cache po zmazaní:** invalidate `ADMIN.PROJECTS()` a `PROJECTS.LIST()`, `removeQueries(PROJECTS.DETAIL(id))`. Ak je zmazaný projekt práve otvorený v inom tabe, `projectRoute` loader dostane 404 a ukáže `ProjectNotFoundPage` (už existuje).
- **Cache po úprave:** `useUpdateProjectSettingsMutation` pridá invalidáciu `ADMIN.PROJECTS()`.
- **Nový endpoint na zoznam** namiesto rozšírenia `GET /api/projects`: index nepotrebuje počty ani dátum a zoznam pre EDITOR-a sa nemení.

## Kontrakt (`packages/shared/src/adminProjects.ts`)

```ts
/** One row of `GET /api/admin/projects`. */
export const adminProjectListItemSchema = z.object({
	id: z.uuid(),
	name: z.string(),
	slug: z.string(),
	primaryColor: z.string(),
	baseLanguageTag: z.enum(LANGUAGE_TAGS).nullable(),
	languageCount: z.number().int(),
	memberCount: z.number().int(),
	createdAt: z.iso.datetime(),
})

/** Body of `GET /api/admin/projects`, sorted by name. */
export const adminProjectListResponseSchema = z.object({ projects: z.array(adminProjectListItemSchema) })
```

Žiadny nový error kód: `NOT_FOUND`, `FORBIDDEN`, `SLUG_TAKEN`, `VALIDATION_ERROR` už existujú.

## API

| Metóda a cesta                         | Kto   | Odpoveď                                                              |
| -------------------------------------- | ----- | -------------------------------------------------------------------- |
| `GET /api/admin/projects`              | ADMIN | `200 AdminProjectListResponse`                                       |
| `DELETE /api/admin/projects/:projectId` | ADMIN | `204`; `404 NOT_FOUND` pre neplatné UUID alebo neexistujúci projekt  |
| `GET/PATCH /api/projects/:projectId/settings` | ADMIN alebo člen | bez zmeny, použije ho modal                          |

BE: `routes/adminProjects.routes.ts` pripojený v `admin.routes.ts` (`router.use('/projects', …)`), `controllers/adminProjects.controller.ts`, `services/adminProjects.service.ts` (`findMany` s `_count: { members, languages }` a `languages: { where: { isBase: true } }`; delete cez `deleteMany({ where: { id } })` a `count === 0` → 404, aby súbežné zmazanie nehádzalo P2025).

## Kroky

| # | Rola | Čo | Overenie |
| - | ---- | -- | -------- |
| 1 | orchestrator | kontrakt `adminProjects.ts` + export v `index.ts` + unit test schémy, commit na `feature/admin-projects` | `pnpm --filter @locale/shared test`, `pnpm typecheck` |
| 2 | backend-developer | route, controller, service; integračné testy: ADMIN list (počty, base jazyk, poradie), EDITOR 403, anonym 401, delete 204 + kaskáda členov a jazykov, delete 404 (neexistujúci, neplatné UUID), používatelia po zmazaní ostávajú | `pnpm --filter backend test:integration`, skill `api-smoke` |
| 3 | frontend-developer | `QUERY_KEYS.ADMIN.PROJECTS`, `api/adminProjects/` (query + `useDeleteProjectMutation`), route, `AdminProjectsPage`, `AdminProjectsTable`, `EditProjectModal`, `DeleteProjectModal`, úprava `ProjectSettingsForm` a `useUpdateProjectSettingsMutation`, `NavItem` v `Sidebar`, i18n `adminProjectsPage.*` v `sk.json` + `en.json`; unit testy (riadky, loading, empty, error + retry, úprava v modale vrátane `SLUG_TAKEN`, zmazanie, EDITOR bez položky v sidebari) | `pnpm lint`, `pnpm --filter frontend typecheck`, `pnpm --filter frontend test`, `pnpm --filter frontend build` |
| 4 | e2e-tester | happy path: ADMIN otvorí Projekty, upraví názov v modale (zoznam sa obnoví bez reloadu), zmaže projekt; EDITOR dostane 403 na `/admin/projects` | `pnpm test:e2e` |
| 5 | accessibility-reviewer, code-reviewer | `aria-label` tabuľky („Zoznam projektov“), focus po otvorení/zatvorení modalov, review diffu | report |
| 6 | orchestrator | `docs/api/admin-projects.md`, `docs/frontend.md`, `docs/changelog.md`, merge, `pnpm verify`, `pnpm stack:up` a kontrola na `http://localhost:8080/admin/projects` | skill `docs-update`, `pnpm verify` |

## Rozhodnuté otázky (2026-10-18)

1. **Potvrdenie mazania:** admin musí prepísať slug projektu. Kontrola je iba na FE (tlačidlo je disabled do zhody), `DELETE` nemá telo.
2. **Figma:** návrh nie je, použije sa štýl `UsersTable` a `AppModal`.
3. **Upraviť** sa robí v modale.
4. **Neuložené zmeny:** pri zatvorení modalu sa zahodia bez otázky (ako `CreateUserModal`).
