import { createRouter } from '@tanstack/react-router'

import queryClient from '@/api/queryClient'
import { indexRoute } from '@/routes/indexRoute'
import { rootRoute } from '@/routes/rootRoute'

const routeTree = rootRoute.addChildren([indexRoute])

export const createAppRouter = (options?: Pick<Parameters<typeof createRouter>[0], 'history'>) =>
	createRouter({ routeTree, context: { queryClient }, ...options })

export const router = createAppRouter()

declare module '@tanstack/react-router' {
	// Module augmentation requires an interface.
	// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
	interface Register {
		router: typeof router
	}
}
