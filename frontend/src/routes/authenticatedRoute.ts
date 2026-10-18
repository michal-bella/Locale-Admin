import { createRoute, redirect } from '@tanstack/react-router'

import { meQueryOptions } from '@/api/auth/meQuery'
import { isUnauthorizedError } from '@/api/isUnauthorizedError'
import { rootRoute } from '@/routes/rootRoute'

/** Pathless parent of every signed-in page: loads the user and passes it to child guards as `context.user`. Layouts are its children. */
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
})
