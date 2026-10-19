import { createRoute } from '@tanstack/react-router'

import { ROLE } from '@locale/shared'

import RouteError from '@/components/RouteError/RouteError'
import { ForbiddenError } from '@/lib/forbiddenError'
import { appLayoutRoute } from '@/routes/appLayoutRoute'

export const adminUserRoute = createRoute({
	getParentRoute: () => appLayoutRoute,
	path: '/admin/users/$userId',
	beforeLoad: ({ context }) => {
		if (context.user.role !== ROLE.ADMIN) {
			throw new ForbiddenError()
		}
	},
	// Stays eager: the 403 page must render from the guard without waiting for the page chunk.
	errorComponent: RouteError,
}).lazy(() => import('@/routes/adminUserRoute.lazy').then((module) => module.Route))
