import { createRoute, redirect } from '@tanstack/react-router'

import { meQueryOptions } from '@/api/auth/meQuery'
import { loginSearchSchema } from '@/routes/loginSearch'
import { rootRoute } from '@/routes/rootRoute'

export const loginRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/login',
	validateSearch: loginSearchSchema,
	beforeLoad: async ({ context }) => {
		// Any failure (401, backend down) means the login form is the right page to show.
		const user = await context.queryClient.query({ ...meQueryOptions, staleTime: 'static' }).catch(() => null)
		if (user) {
			redirect({ to: '/', throw: true })
		}
	},
}).lazy(() => import('@/routes/loginRoute.lazy').then((module) => module.Route))
