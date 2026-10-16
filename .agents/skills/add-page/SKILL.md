---
name: add-page
description: Step-by-step recipe for adding a new page to the Locale Admin SPA (lazy TanStack route with guard, API hooks with QUERY_KEYS, page and components from Figma, loading/empty/error states, form modal with server errors, i18n, unit and E2E tests, docs). Use when a task adds a new screen or route in frontend/.
---

# Add a page

Written from how the Používatelia page (`/admin/users`) was built (milestone C). Rules: `frontend/AGENTS.md`, skills `frontend-conventions` and `figma-to-code`.

## 1. Route (lazy page, eager guard)

- `src/routes/<name>Route.ts`: `createRoute({ getParentRoute: () => authenticatedRoute, path, beforeLoad, errorComponent })` and `.lazy(() => import('@/routes/<name>Route.lazy').then((m) => m.Route))`.
- `src/routes/<name>Route.lazy.ts`: `createLazyRoute('<route id>')({ component: Page })`. The id includes the pathless parent: `/_authenticated/admin/users`. A wrong id fails `typecheck` (the tree is registered in `router.ts`).
- Keep `beforeLoad` and `errorComponent` in the eager file, so a role guard (`throw new ForbiddenError()` → `RouteError` → 403 page) renders without loading the page chunk.
- Add the route to the tree in `src/routes/router.ts`. A link in the top-bar menu goes to `components/UserMenu` (role-filtered there).

## 2. Data hooks (`src/api/<area>/`)

- Key in `QUERY_KEYS` (`ADMIN.USERS()`), never inline.
- Query: `queryOptions({ queryKey, queryFn: async () => (await http.get<Type>('/path')).data })` + `use<X>Query`.
- Mutation: `useMutation` with `onSuccess: () => queryClient.invalidateQueries(...)` returned (awaited), so the list is fresh before the caller closes a modal.
- Types only from `@locale/shared`.

## 3. Page and components

- Read Figma with `get_design_context` + `get_screenshot` (skill `figma-to-code`); map values to the Mantine theme, export icons via `pnpm --filter frontend generate-icons`.
- Page in `src/pages/<Name>Page/` composes `PageIntro` (eyebrow, title, description) and components in `src/components/<Name>/` (`<Name>.tsx`, `types.ts`, `<Name>.module.css`).
- States not in Figma: loading (`Skeleton` rows, `aria-busy`), empty text, error with ``t(`errors.${getApiErrorCode(error)}`)`` and a retry button (`refetch`).
- Dates: `formatDate(value, i18n.language)` from `src/lib/formatDate.ts` (`Intl.DateTimeFormat`, `sk-SK` / `en-GB`), no date library.
- Accessible names for E2E: `aria-label` on tables (`Zoznam používateľov`), labels on inputs, dialog title.

## 4. Form in a modal

- React Hook Form + `zodResolver(sharedSchema)`; the same schema the BE parses.
- Server errors: 400 → each `details` item to `setError(path, { message: t(`validation.${code}`, params) })`; known conflict codes (409 `EMAIL_TAKEN`) → `setError` on the field with ``t(`errors.${code}`)``; anything else → red notification. Never show the BE `message`.
- Submit button `loading` and ignore submits while pending; on success: notification, `reset()`, close. Closing (Cancel, X, Esc, overlay) also resets.
- Placeholders with constants via i18n interpolation (`Min. {{min}} znakov` with `PASSWORD_MIN_LENGTH`).

## 5. i18n

Keys under `<name>Page.*` in both `src/locales/sk.json` and `en.json` (types come from `sk.json`).

## 6. Tests and checks

- Unit (`src/pages/<Name>Page/<Name>Page.test.tsx`): render via `renderApp` with `mockApi` (`signedInAs`, `apiError`); cover rows, loading, empty, error + retry, both languages for dates, form client validation, 400 and 409 at the fields, success flow.
- `pnpm lint` (root), `pnpm --filter frontend typecheck`, `pnpm --filter frontend test`, `pnpm --filter frontend build` (watch the >500 kB chunk warning).
- E2E (E2E Tester, skill `testing`): happy path without reload, field errors, role 403, then a one-time Playwright-vs-Figma screenshot comparison reported to the user.
- `docs/frontend.md` (routes, page, states) — skill `docs-update`.
