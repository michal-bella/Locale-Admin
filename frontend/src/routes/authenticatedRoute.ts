import { createRoute, redirect } from '@tanstack/react-router'

import { meQueryOptions } from '@/api/auth/meQuery'
import { isUnauthorizedError } from '@/api/isUnauthorizedError'
import AppLayout from '@/components/AppLayout/AppLayout'
import { rootRoute } from '@/routes/rootRoute'

/** Pathless layout for every signed-in page: loads the user (top bar) and passes it to child guards as `context.user`. */
export const authenticatedRoute = createRoute({
	getParentRoute: () => rootRoute,
	id: '_authenticated',
	beforeLoad: async ({ context }) => {
		try {
			const user = await context.queryClient.ensureQueryData(meQueryOptions)
			return { user }
		} catch (error) {
			if (isUnauthorizedError(error)) {
				redirect({ to: '/login', throw: true })
			}
			throw error
		}
	},
	component: AppLayout,
})
