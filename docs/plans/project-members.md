---
title: 'Členovia projektu z existujúcich používateľov – implementačný plán (MVP)'
updated: 2026-10-19
notion_page_id:
---

# Členovia projektu z existujúcich používateľov – implementačný plán (MVP)

Používatelia sa spravujú **centrálne na `/admin/users`** (ADMIN aj Člen) a do projektu sa **priraďujú z existujúcich používateľov**. Dnes `POST /api/projects/:projectId/members` vždy vytvorí nového používateľa (email + heslo), takže jedného človeka nejde dať do dvoch projektov (druhý pokus skončí `409 EMAIL_TAKEN`) a `/admin/users` zobrazuje iba adminov. Dátový model sa nemení: `User` je globálny, `ProjectMember` je väzba `projectId + userId`.

Postup podľa `.agents/workflows/feature.md` na vetve `feature/project-members`: kontrakt v `packages/shared`, potom BE a FE paralelne vo vlastných worktree, E2E, review. Po každom kroku checkpoint (`pnpm verify`, `docs/`, commit, krátky report).

## Predpoklady

- **Priraďuje iba ADMIN.** Pridať a odobrať člena projektu môže len `ADMIN`. Člen (`EDITOR`) zoznam členov vidí, ale bez tlačidla Pridať a bez akcií v riadkoch; API mu vráti 403. Opustiť projekt (`DELETE /membership`) ostáva pre každého člena.
- **Používateľov vytvárajú admini s interným heslom.** Žiadne pozvánky, emaily ani tokeny. Heslo si používateľ zmení v profile.
- **Bez organizácií a projektových rolí.** Všetci členovia projektu majú rovnaké práva ako doteraz.
- **Bez zmeny schémy a migrácie.** `User.role`, `ProjectMember` a kaskády stačia.

## Rozsah

| Prvok                                                                                                                        | MVP                                                       |
| ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `/admin/users` zobrazí **všetkých** používateľov; stĺpec Rola (Admin / Člen) a počet projektov                                | áno                                                       |
| Modal **Nový používateľ** s výberom roly (Admin / Člen), predvolene Člen                                                     | áno                                                       |
| Zmazať používateľa (aj Člena); členstvá sa zmažú kaskádou                                                                    | áno                                                       |
| Stránka Členovia projektu: tlačidlo **Pridať člena** otvorí výber z existujúcich používateľov, ktorí ešte nie sú v projekte | áno, iba ADMIN                                            |
| V modale Pridať člena odkaz **Vytvoriť nového používateľa** (otvorí `CreateUserModal` s rolou Člen, nový sa predvyberie)     | áno                                                       |
| Odobrať člena z projektu                                                                                                     | áno, iba ADMIN                                            |
| Člen (EDITOR) na stránke Členovia                                                                                            | vidí zoznam, bez Pridať a bez akcií v riadku              |
| Detail používateľa `/admin/users/$userId` so zoznamom jeho projektov a pridaním / odobratím projektu                        | **druhá časť** (viď nižšie), nie je nutná pre MVP        |
| Úprava používateľa (email, rola, reset hesla), deaktivácia, vyhľadávanie, stránkovanie                                       | **nie**                                                   |
| Pozvánky emailom                                                                                                             | **nie**                                                   |

## Rozhodnutia

- **`POST /api/projects/:projectId/members` berie `{ userId }`** namiesto `{ email, password }`. Nový používateľ sa vytvára iba cez `POST /api/admin/users`. Schéma sa premenuje na `addProjectMemberRequestSchema` (sémantika sa mení, názov „create“ by zavádzal).
- **ADMIN-only na členoch cez `requireRole(ROLE.ADMIN)` za `requireProjectAccess`** (rovnako ako `PATCH /keys/:keyId`). `requireProjectAccess` ADMINa pustí do každého projektu, poradie middleware dá členovi 403 a cudziemu 404.
- **Výber používateľa bez nového endpointu.** Modal Pridať člena načíta `GET /api/admin/users` (modal je iba pre ADMINa, ktorý tam má prístup) a klientsky odfiltruje aktuálnych členov. Tím je malý, vyhľadávací endpoint netreba. Ak zoznam narastie, pribudne `?search=` bez zmeny tvaru odpovede.
- **`GET /api/admin/users` vráti všetkých používateľov** (ADMIN aj EDITOR) a každému pridá `projectCount`. Poradie ostáva od najnovšieho. `AdminUser` už `role` má, FE zatiaľ nezobrazovalo.
- **`POST /api/admin/users` dostane povinné `role`** (`z.enum(ROLE)`). Bez neho by sa admin nedal odlíšiť od člena; FE má predvolené Člen.
- **`DELETE /api/admin/users/:id` zmaže ktoréhokoľvek používateľa**, nie len ADMINa. Vlastný účet sa zmazať nedá (`409 SELF_DELETE`), takže aspoň jeden admin vždy ostane. Členstvá a session odídu kaskádou. Projekt môže ostať bez člena, ADMIN ho ďalej vidí a spravuje.
- **`LAST_MEMBER` sa nemení.** Odobratie posledného člena a opustenie projektu posledným členom ďalej vracia 409; pravidlo chráni projekt pred „stratením“ pre členov a jeho zmena nie je súčasťou tejto úlohy.
- **Nový error kód `ALREADY_MEMBER` (409)** pre pridanie používateľa, ktorý už v projekte je (P2002 na zloženom primárnom kľúči). Neexistujúci `userId` vráti `404 NOT_FOUND`. `EMAIL_TAKEN` ostáva pre `POST /api/admin/users`.
- **Modal `AddMemberModal`** (`components/AddMemberModal/`) nahradí `CreateMemberModal`: `AppModal` s Mantine `Select` (`searchable`, položka = email, pod ním meno ak je; `nothingFoundMessage`), načítanie cez `useAdminUsersQuery` so skeletonom, chyba = text + Skúsiť znova. Pod selectom sekundárne tlačidlo **Vytvoriť nového používateľa**, ktoré otvorí `CreateUserModal` (rola predvolene Člen) a po vytvorení nového používateľa predvyberie; admin potvrdí Pridať. Žiadne reťazenie dvoch mutácií, chyby ostávajú jednoduché.
- **`CreateUserModal` dostane props `defaultRole?: Role` a `onCreated?: (user: AdminUser) => void`.** Výber roly je `SegmentedControl` (Admin / Člen) s popisom, čo rola znamená.
- **`MembersTable` a `MembersPage` sa riadia `useMeQuery().role`.** Pre EDITORa sa nerenderuje tlačidlo Pridať ani `RowAction`; stĺpec akcií ostáva (prázdny), aby sa tabuľka neprekresľovala podľa roly.
- **Cache:** `useAddProjectMemberMutation` a `useRemoveProjectMemberMutation` invalidujú `PROJECTS.MEMBERS(id)` a `ADMIN.USERS()` (mení sa `projectCount`). `useCreateUserMutation` a `useDeleteUserMutation` invalidujú `ADMIN.USERS()`; delete navyše invaliduje `PROJECTS.MEMBERS` prefix (`['projects']` cez `predicate`), lebo zmazaný používateľ mohol byť členom otvoreného projektu.
- **Seed a E2E:** seed sa nemení (jeden ADMIN). E2E vytvorí Člena cez `POST /api/admin/users` s `role: EDITOR` namiesto doterajšieho `POST /members`.

## Kontrakt (`packages/shared`)

`adminUsers.ts`:

```ts
/** Body of `POST /api/admin/users`. */
export const createUserRequestSchema = z.object({
	email: emailSchema,
	password: passwordSchema,
	role: z.enum(ROLE),
})

/** One user in the admin list and the body of `201 POST /api/admin/users`. Never contains `passwordHash`. */
export const adminUserSchema = z.object({
	id: z.uuid(),
	email: z.email(),
	role: z.enum(ROLE),
	projectCount: z.number().int(),
	createdAt: z.iso.datetime(),
})
```

`projects.ts`:

```ts
/** Body of `POST /api/projects/:projectId/members`: adds an existing user to the project. ADMIN only. */
export const addProjectMemberRequestSchema = z.object({ userId: z.uuid() })
```

`errors.ts`: `ALREADY_MEMBER` (409) + preklad v `errors.*` (sk, en, cs). `createProjectMemberRequestSchema` a `CreateProjectMemberRequest` sa zmažú.

## API

| Metóda a cesta                                   | Kto              | Zmena                                                                                                 |
| ------------------------------------------------ | ---------------- | ----------------------------------------------------------------------------------------------------- |
| `GET /api/admin/users`                           | ADMIN            | všetci používatelia, pole `projectCount` (`_count: { projectMemberships }`)                               |
| `POST /api/admin/users`                          | ADMIN            | telo `{ email, password, role }`, vytvorí používateľa s danou rolou                                   |
| `DELETE /api/admin/users/:id`                    | ADMIN            | zmaže ktoréhokoľvek používateľa okrem seba; `404 NOT_FOUND`, `409 SELF_DELETE`                         |
| `GET /api/projects/:projectId/members`           | ADMIN alebo člen | bez zmeny                                                                                             |
| `POST /api/projects/:projectId/members`          | ADMIN            | telo `{ userId }`; `201 ProjectMember`; `403 FORBIDDEN` člen; `404 NOT_FOUND` neexistujúci používateľ; `409 ALREADY_MEMBER` |
| `DELETE /api/projects/:projectId/members/:userId` | ADMIN            | `403 FORBIDDEN` pre člena; inak bez zmeny (`404`, `409 LAST_MEMBER`)                                   |
| `DELETE /api/projects/:projectId/membership`     | člen             | bez zmeny (opustiť projekt)                                                                           |

BE: `projectMembers.service.ts` `addProjectMember` (`projectMember.create` s `connect` na používateľa; P2025 → 404, P2002 → 409 `ALREADY_MEMBER`), `adminUsers.service.ts` (`listUsers` bez filtra roly + `_count`, `createUser` s `role`, `deleteUser` namiesto `deleteAdmin`). Routy v `projects.routes.ts` dostanú `requireRole(ROLE.ADMIN)` na `POST`/`DELETE` members.

## Frontend

- `/admin/users`: `UsersTable` dostane stĺpce Rola (`Badge`: Admin / Člen) a Projekty (počet); `DeleteAdminModal` → `DeleteUserModal` s textom o dopade (odoberie sa z N projektov). `CreateUserModal` s výberom roly.
- `/projects/$projectSlug/members`: `MembersPage` tlačidlo **Pridať člena** iba pre ADMINa, `AddMemberModal`, `MembersTable` akcie iba pre ADMINa. `CreateMemberModal` a `useCreateProjectMemberMutation` sa zmažú, pribudne `useAddProjectMemberMutation`.
- i18n: `usersPage.table.role`, `usersPage.table.projects`, `usersPage.createModal.role.*`, `membersPage.addModal.*` (title, description, user.label, user.placeholder, nothingFound, createUser, submit, success), `errors.ALREADY_MEMBER` v `sk.json`, `en.json`, `cs.json`.

## Kroky

| # | Rola | Čo | Overenie |
| - | ---- | -- | -------- |
| 1 | orchestrator | kontrakt: `createUserRequestSchema.role`, `adminUserSchema.projectCount`, `addProjectMemberRequestSchema`, `ERROR_CODE.ALREADY_MEMBER`, unit testy schém, commit na `feature/project-members` | `pnpm --filter @locale/shared test`, `pnpm typecheck` |
| 2 | backend-developer | služby, controllery, routy; integračné testy: list všetkých s `projectCount`, create ADMIN aj EDITOR, delete EDITORa zmaže členstvá, delete seba 409; add member 201 / 403 pre člena / 404 cudzí projekt a neexistujúci používateľ / 409 už člen; remove member 403 pre člena, ADMIN 204, `LAST_MEMBER` ostáva; pôvodné testy `POST /members` s emailom a heslom sa zmažú | `pnpm --filter backend test:integration`, skill `api-smoke` |
| 3 | frontend-developer | `UsersTable` (rola, projekty), `CreateUserModal` (rola, `defaultRole`, `onCreated`), `DeleteUserModal`, `AddMemberModal`, `MembersPage` a `MembersTable` podľa roly, `useAddProjectMemberMutation`, invalidácie, i18n; unit testy: EDITOR nevidí Pridať ani akcie, ADMIN pridá existujúceho (odfiltrovaní členovia), `ALREADY_MEMBER` ako chyba selectu, vytvorenie nového z modalu ho predvyberie, rola v tabuľke a modale, zmazanie člena | `pnpm lint`, `pnpm --filter frontend typecheck`, `pnpm --filter frontend test`, `pnpm --filter frontend build` |
| 4 | e2e-tester | `users.spec.ts`: ADMIN vytvorí Člena s rolou, Člen sa prihlási; `members.spec.ts`: ADMIN pridá existujúceho Člena do projektu a odoberie ho, Člen vidí zoznam bez Pridať a bez akcií, `api-smoke`: EDITOR `POST /members` → 403; nahradenie doterajšieho vytvárania člena cez `POST /members` v setupe | `pnpm test:e2e` |
| 5 | accessibility-reviewer, code-reviewer | `Select` s `aria-describedby` na chybu, `SegmentedControl` roly s názvom skupiny, focus po zatvorení vnoreného `CreateUserModal` späť na select, review diffu | report |
| 6 | orchestrator | `docs/api/admin-users.md`, `docs/api/projects.md#členovia`, `docs/frontend.md`, `docs/changelog.md`, riadky Member a Project member v `AGENTS.md` (členov priraďuje ADMIN), merge, `pnpm verify`, `pnpm stack:up` a kontrola na `http://localhost:8080/admin/users` a `/projects/b2b-admin-test/members` | skill `docs-update`, `pnpm verify` |

## Druhá časť: detail používateľa (po MVP)

Hotové 2026-10-19 na vetve `feature/admin-user-detail` (viď [changelog](../changelog.md)).

Stránka `/admin/users/$userId` (iba ADMIN): karta s emailom, rolou a dátumom, pod ňou tabuľka projektov používateľa s akciou Odobrať a tlačidlom Pridať do projektu (select z projektov, kde ešte nie je). Riadok v `UsersTable` dostane akciu Otvoriť (ikona šípky, ako v `AdminProjectsTable`).

- Kontrakt: `adminUserDetailSchema = adminUserSchema.extend({ projects: z.array({ id, name, slug, primaryColor, joinedAt }) })`.
- API: `GET /api/admin/users/:id` (`404 NOT_FOUND`). Pridanie a odobratie používa existujúce `POST`/`DELETE /api/projects/:projectId/members`, nový endpoint netreba; FE invaliduje `ADMIN.USER(id)`, `ADMIN.USERS()` a `PROJECTS.MEMBERS(projectId)`.
- Route `adminUserRoute.ts` + `.lazy.ts` pod `/admin/users` rovnako ako `adminUsersRoute`.

## Rozhodnuté otázky (2026-10-19)

1. **Kto priraďuje členov:** iba ADMIN. Člen zoznam vidí, nepridáva ani neodoberá.
2. **Vytvorenie používateľa priamo z projektu:** áno, odkaz v modale Pridať člena otvorí `CreateUserModal` s rolou Člen; nový používateľ sa predvyberie.
3. **Pozvánky:** nie. Používateľov zakladajú admini s interným heslom.
4. **Figma:** návrh nie je, použije sa štýl `UsersTable`, `MembersTable` a `AppModal`.
