---
name: frontend-conventions
description: How frontend code in Locale Admin is structured and written (folders, component files, Mantine + Tailwind styling, i18n keys, TanStack Router and Query, axios, forms). Use when adding or changing anything in frontend/src.
---

# Frontend conventions

Module rules: `frontend/AGENTS.md`. Human docs: `docs/frontend.md`. Structure and style follow the team's Notino Landing frontend (atoms / components / pages, `types.ts`, default exports, `QUERY_KEYS`), adapted to a Vite+ SPA.

## Files

```
src/atoms/ButtonLink/ButtonLink.tsx     default export
src/atoms/ButtonLink/types.ts           props types
src/components/PageIntro/PageIntro.module.css
src/pages/NotFoundPage/NotFoundPage.tsx
src/pages/NotFoundPage/NotFoundPage.test.tsx
```

- Components: default export, import by full path `@/components/PageIntro/PageIntro`. Only `components/Icons/index.ts` is a barrel.
- Routes, API helpers and lib modules use named exports.
- Pages compose components; components compose atoms. Reusable layout pieces: `CenteredLayout` (background, brand, footer), `Brand`, `PageIntro` (eyebrow, h1, description).

## Styling

1. Mantine theme (`src/styles/mantineTheme.ts`): colors `brand` (primary pink) and `slate` (Tailwind v4 slate 50–900), radius, shadows, font sizes, component defaults (`Button.extend`).
2. CSS modules for component-specific styles, using Mantine CSS variables (`var(--mantine-color-brand-7)`, `var(--mantine-font-size-xs)`).
3. Tailwind utilities only for layout and spacing (`flex`, `gap-4`, `min-h-dvh`).

- Never hardcode hex colors in components. Layer order in `src/styles/global.css`: `@layer theme, base, mantine, components, utilities;` — keep it so Tailwind preflight does not override Mantine.
- Font: DM Sans from `@fontsource-variable/dm-sans` (no CDN).

## i18n

- `useTranslation()` + `t('page.section.key')`. Keys nested by page/component: `notFoundPage.title`, `users.createModal.email.label`.
- Add every key to both `src/locales/sk.json` and `en.json`. Keys are typed from `sk.json` (`src/types/i18next.d.ts`), so a missing `sk` key is a type error.
- API errors: ``t(`errors.${getApiErrorCode(error)}`)``. Field errors: ``t(`validation.${issue.code}`, issue.params)``. Never show the BE `message`.
- Language is stored in `localStorage['locale']` (`LOCALE_STORAGE_KEY`), default `sk`.

## Data

- One axios instance `src/api/http.ts` (`baseURL: '/api'`, `withCredentials`, adds `X-Requested-With` and `{}` body for mutations without data). Never call `fetch` or another axios instance.
- Query keys only via `QUERY_KEYS` in `src/api/queryKeys.ts`. Wrap queries and mutations in hooks in `src/api/` (e.g. `useUsersQuery`), components never build query keys.
- Response and request types come from `@locale/shared` (`z.infer` types).

## Routing (TanStack Router, code-based, ADR 0002)

- One file per route in `src/routes/` (`indexRoute.ts`), added to the tree in `src/routes/router.ts`.
- Unknown routes render `NotFoundPage` via `notFoundComponent` on the root route.
- Protected pages are children of the pathless layout route `authenticatedRoute` (`_authenticated`, renders `AppLayout` with the top bar). Its `beforeLoad` calls `context.queryClient.ensureQueryData(meQueryOptions)`, redirects to `/login` on 401 and passes `context.user` to children.
- Role-only pages throw `ForbiddenError` (`lib/forbiddenError.ts`) from `beforeLoad`; the route's `errorComponent` (`components/RouteError`) renders `ForbiddenPage` and keeps the URL (see `adminUsersRoute.ts`).
- `/login` redirects a signed-in user to `/`. No `?redirect=` in phase 1.
- Auth hooks: `meQueryOptions` / `useMeQuery`, `useLoginMutation`, `useLogoutMutation` in `src/api/auth/`. A 401 on any request other than `/auth/login` and `/auth/me` clears the whole query cache (`queryClient.clear()`, like logout) and navigates to `/login` (`api/unauthorizedInterceptor.ts`); the guards handle `/auth/me` themselves.

## Forms

React Hook Form + `zodResolver(schemaFromShared)`. Map BE `details` to fields with ``setError(path, { message: t(`validation.${code}`, params) })``.

## Tests

- Render the whole app with `renderApp` (`src/test/renderApp.tsx`) and mock the API with `src/test/mockApi.ts` (`signedInAs(user)`, `signedOut()`, `apiError(...)`).

Vite+ test runner (`import { describe, it, expect } from 'vite-plus/test'`), jsdom, Testing Library. Render through the router with `createAppRouter({ history: createMemoryHistory({ initialEntries: ['/x'] }) })` when routing matters.
