import { createRouter } from '@tanstack/react-router'

import queryClient from '@/api/queryClient'
import ErrorPage from '@/pages/ErrorPage/ErrorPage'
import { adminUsersRoute } from '@/routes/adminUsersRoute'
import { authenticatedRoute } from '@/routes/authenticatedRoute'
import { indexRoute } from '@/routes/indexRoute'
import { loginRoute } from '@/routes/loginRoute'
import { rootRoute } from '@/routes/rootRoute'

const routeTree = rootRoute.addChildren([loginRoute, authenticatedRoute.addChildren([indexRoute, adminUsersRoute])])

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
