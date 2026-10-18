import { createRouter } from '@tanstack/react-router'

import queryClient from '@/api/queryClient'
import ErrorPage from '@/pages/ErrorPage/ErrorPage'
import { adminProjectsRoute } from '@/routes/adminProjectsRoute'
import { adminUsersRoute } from '@/routes/adminUsersRoute'
import { appLayoutRoute } from '@/routes/appLayoutRoute'
import { authenticatedRoute } from '@/routes/authenticatedRoute'
import { homeLayoutRoute } from '@/routes/homeLayoutRoute'
import { indexRoute } from '@/routes/indexRoute'
import { loginRoute } from '@/routes/loginRoute'
import { profileRoute } from '@/routes/profileRoute'
import { projectIndexRoute } from '@/routes/projectIndexRoute'
import { projectLanguagesRoute } from '@/routes/projectLanguagesRoute'
import { projectMembersRoute } from '@/routes/projectMembersRoute'
import { projectRoute } from '@/routes/projectRoute'
import { projectSettingsRoute } from '@/routes/projectSettingsRoute'
import { rootRoute } from '@/routes/rootRoute'

const routeTree = rootRoute.addChildren([
	loginRoute,
	authenticatedRoute.addChildren([
		homeLayoutRoute.addChildren([indexRoute]),
		appLayoutRoute.addChildren([
			profileRoute,
			adminProjectsRoute,
			adminUsersRoute,
			projectRoute.addChildren([projectIndexRoute, projectSettingsRoute, projectLanguagesRoute, projectMembersRoute]),
		]),
	]),
])

export const createAppRouter = (options?: Pick<Parameters<typeof createRouter>[0], 'history'>) =>
	createRouter({
		routeTree,
		context: { queryClient },
		defaultErrorComponent: ErrorPage,
		...options,
	})

export type AppRouter = ReturnType<typeof createAppRouter>

export const router = createAppRouter()

declare module '@tanstack/react-router' {
	// Module augmentation requires an interface.
	// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
	interface Register {
		router: typeof router
	}
}
