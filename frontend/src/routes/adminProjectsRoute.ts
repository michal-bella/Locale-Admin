import { createRoute } from '@tanstack/react-router'

import { ROLE } from '@locale/shared'

import RouteError from '@/components/RouteError/RouteError'
import { ForbiddenError } from '@/lib/forbiddenError'
import { adminSearchSchema } from '@/routes/adminSearch'
import { appLayoutRoute } from '@/routes/appLayoutRoute'

export const adminProjectsRoute = createRoute({
	getParentRoute: () => appLayoutRoute,
	path: '/admin/projects',
	validateSearch: adminSearchSchema,
	beforeLoad: ({ context }) => {
		if (context.user.role !== ROLE.ADMIN) {
			throw new ForbiddenError()
		}
	},
	// Stays eager: the 403 page must render from the guard without waiting for the page chunk.
	errorComponent: RouteError,
}).lazy(() => import('@/routes/adminProjectsRoute.lazy').then((module) => module.Route))
