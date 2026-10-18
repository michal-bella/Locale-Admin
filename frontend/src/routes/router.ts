import { createRouter } from '@tanstack/react-router'

import queryClient from '@/api/queryClient'
import ErrorPage from '@/pages/ErrorPage/ErrorPage'
import { adminUsersRoute } from '@/routes/adminUsersRoute'
import { appLayoutRoute } from '@/routes/appLayoutRoute'
import { authenticatedRoute } from '@/routes/authenticatedRoute'
import { homeLayoutRoute } from '@/routes/homeLayoutRoute'
import { indexRoute } from '@/routes/indexRoute'
import { languagesRoute } from '@/routes/languagesRoute'
import { loginRoute } from '@/routes/loginRoute'
import { profileRoute } from '@/routes/profileRoute'
import { projectIndexRoute } from '@/routes/projectIndexRoute'
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
			adminUsersRoute,
			languagesRoute,
			projectRoute.addChildren([projectIndexRoute, projectSettingsRoute, projectMembersRoute]),
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
