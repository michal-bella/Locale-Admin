---
title: 'Projekty a Členovia – implementačný plán (MVP)'
updated: 2026-10-18
notion_page_id:
---

# Projekty a Členovia – implementačný plán (MVP)

Index stránka `/` zobrazí **zoznam projektov** prihláseného používateľa bez sidebaru. Odtiaľ sa dá vytvoriť projekt, opustiť projekt a prejsť do projektu, kde je layout so sidebarom (Nastavenia projektu, Členovia). Organizácie sa úplne vypúšťajú: používateľ (člen) je sám sebe „organizáciou“. Projektové role prídu neskôr. Postup podľa `.agents/workflows/feature.md` na vetve `feature/projects`.

## Predpoklady

- **Admin** je `User.role = ADMIN` (zatiaľ iba seedovaný `michal.bella@goodrequest.com`). Vidí **všetky projekty**, Jazyky a stránku `/admin/users`, ktorá zobrazuje a vytvára **iba adminov**.
- **Člen** je `User.role = EDITOR` (enum sa nemení, v UI sa volá „Člen“). Vidí iba projekty, kde má `ProjectMember`. Vytvára projekty, upravuje ich nastavenia a pridáva ďalších členov.
- **Prístup k projektu** = ADMIN alebo existuje `ProjectMember`. Inak `404 NOT_FOUND` (neprezrádzame existenciu projektu).
- **Členov vytvára admin aj člen** projektu na stránke Členovia (e-mail + heslo). Nový používateľ má rolu `EDITOR` a hneď je členom projektu. Existujúci e-mail → `409 EMAIL_TAKEN` (pridanie existujúceho používateľa do ďalšieho projektu je follow-up).
- **Vytvorenie projektu** môže každý prihlásený, tvorca sa stane členom. Obsadený slug → `409 SLUG_TAKEN`.
- **Opustiť projekt** zmaže vlastný `ProjectMember`. Posledný člen nemôže odísť → `409 LAST_MEMBER`. Admin, ktorý nie je členom, akciu nevidí.
- **Základný jazyk** ostáva globálny (`Language.isBase`). Meniť ho môže iba ADMIN: `baseLanguageId` je v PATCH nastavení voliteľné; ne-admin, ktorý ho mení (iná hodnota ako aktuálny základný jazyk), dostane `403 FORBIDDEN`.
- Riadok projektu: avatar (iniciály vo farbe projektu), názov, slug, ⋮ menu. Počet kľúčov, progress a vlajky prídu s prekladmi a jazykmi na projekt.
- Mimo rozsahu: odstránenie člena, mazanie projektu, prepínač projektu v sidebari, projektové role.

## Rozhodnutia

- **Dátový model:** bez zmeny schémy, `Project` a `ProjectMember` už existujú. Odstráni sa iba komentár o singletone.
- **Kontrakt** (`packages/shared`):
  - nový `projects.ts`: `projectListItemSchema { id, name, slug, primaryColor, isMember }`, `projectListResponseSchema { projects }`, `createProjectRequestSchema { name, slug }`, `projectMemberSchema { id, email, firstName, lastName, createdAt }`, `projectMemberListResponseSchema { members }`, `createProjectMemberRequestSchema { email, password }`.
  - `projectSettings.ts`: `baseLanguageId` v `updateProjectSettingsRequestSchema` voliteľné.
  - `errors.ts`: `SLUG_TAKEN`, `LAST_MEMBER` (+ preklady vo FE).
- **API** (`/api/projects`, celé za `createRequireAuth`, `:projectId` za `requireProjectAccess`):

  | Metóda | Cesta                                 | Odpoveď                                                     |
  | ------ | ------------------------------------- | ----------------------------------------------------------- |
  | GET    | `/api/projects`                       | `200 { projects }`: admin všetky, člen svoje, zoradené podľa názvu |
  | POST   | `/api/projects`                       | `201 ProjectListItem`, `400`, `409 SLUG_TAKEN`              |
  | DELETE | `/api/projects/:projectId/membership` | `204`, `404` (nie je člen), `409 LAST_MEMBER`               |
  | GET    | `/api/projects/:projectId/settings`   | `200 ProjectSettings`, `404`                                |
  | PATCH  | `/api/projects/:projectId/settings`   | `200 ProjectSettings`, `400`, `403` (base jazyk ne-admin), `404`, `409 SLUG_TAKEN` |
  | GET    | `/api/projects/:projectId/members`    | `200 { members }`, zoradené od najstaršieho                 |
  | POST   | `/api/projects/:projectId/members`    | `201 ProjectMember`, `400`, `409 EMAIL_TAKEN`               |

  `/api/admin/project` sa ruší. `/api/admin/users` filtruje a vytvára iba `ADMIN`.

- **FE:** `/` → `ProjectsPage` v layoute bez sidebaru; `/projects/$projectId/settings` a `/projects/$projectId/members` v `AppLayout`; `/project-settings` sa ruší. Sidebar v projekte: názov projektu, „Všetky projekty“, Nastavenia projektu, Členovia; sekcia SPRÁVA (Používatelia, Jazyky) iba pre ADMIN.

## Kroky

### K1. Kontrakt + plán

- `projects.ts`, úprava `projectSettings.ts`, `errors.ts`, preklady nových kódov, unit testy.
- **Overenie:** `pnpm --filter @locale/shared test`, `pnpm typecheck`.

### K2. Backend

- `middleware/projectAccess.middleware.ts`, `routes/projects.routes.ts`, `controllers`/`services` pre projekty, členov a nastavenia (presun z `adminProject.*`), `adminUsers.service.ts` iba ADMIN.
- Integračné testy: `projects.test.ts`, `projectMembers.test.ts`, `projectSettings.test.ts`, úprava `adminUsers.test.ts`.
- `docs/api/`, `docs/database.md`.
- **Overenie:** `pnpm lint`, `pnpm --filter backend typecheck|test|test:integration`.

### K3. Frontend

- Routing (`HomeLayout`, pathless `_app` s `AppLayout`, `projectRoute`), `ProjectsPage`, `CreateProjectModal`, `LeaveProjectModal`, `MembersPage`, `CreateMemberModal`, Sidebar, `ProjectSettingsForm` s `projectId`, `UsersPage` pre adminov, i18n (vrátane odstránenia textov o organizácii).
- Unit testy, `docs/frontend.md`.
- **Overenie:** `pnpm --filter frontend typecheck|test|build`.

### K4. E2E a docs

- `projects.spec.ts`, `members.spec.ts`, úprava `project-settings.spec.ts`, `sidebar.spec.ts`, `routing.spec.ts`, `users.spec.ts`.
- `AGENTS.md`, `README.md`, `docs/overview.md`, `docs/changelog.md` bez organizácií.
- **Overenie:** `pnpm verify`, `pnpm test:e2e`.

## Akceptačné kritériá

1. Na `/` je zoznam projektov bez sidebaru: admin vidí všetky, člen iba svoje.
2. **+ Projekt** vytvorí projekt, tvorca je jeho členom a presmeruje sa do nastavení.
3. ⋮ → **Opustiť projekt** po potvrdení odstráni členstvo; posledný člen dostane chybu.
4. Klik na projekt otvorí `/projects/$projectId/settings` so sidebarom; člen nastavenia uloží (okrem základného jazyka).
5. Na **Členovia** admin aj člen vytvorí nového člena, ten sa prihlási a vidí iba tento projekt.
6. `/admin/users` zobrazuje a vytvára iba adminov; člen má na `/admin/users` a `/languages` 403.
7. `pnpm verify` a `pnpm test:e2e` prechádzajú.
