import { createRoute, redirect } from '@tanstack/react-router'

import { meQueryOptions } from '@/api/auth/meQuery'
import LoginPage from '@/pages/LoginPage/LoginPage'
import { rootRoute } from '@/routes/rootRoute'

export const loginRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/login',
	beforeLoad: async ({ context }) => {
		// Any failure (401, backend down) means the login form is the right page to show.
		const user = await context.queryClient.ensureQueryData(meQueryOptions).catch(() => null)
		if (user) {
			redirect({ to: '/', throw: true })
		}
	},
	component: LoginPage,
})
