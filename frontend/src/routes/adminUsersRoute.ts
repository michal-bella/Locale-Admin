import { createRoute } from '@tanstack/react-router'

import { ROLE } from '@locale/shared'

import RouteError from '@/components/RouteError/RouteError'
import { ForbiddenError } from '@/lib/forbiddenError'
import { adminSearchSchema } from '@/routes/adminSearch'
import { appLayoutRoute } from '@/routes/appLayoutRoute'

export const adminUsersRoute = createRoute({
	getParentRoute: () => appLayoutRoute,
	path: '/admin/users',
	validateSearch: adminSearchSchema,
	beforeLoad: ({ context }) => {
		if (context.user.role !== ROLE.ADMIN) {
			throw new ForbiddenError()
		}
	},
	// Stays eager: the 403 page must render from the guard without waiting for the page chunk.
	errorComponent: RouteError,
}).lazy(() => import('@/routes/adminUsersRoute.lazy').then((module) => module.Route))
