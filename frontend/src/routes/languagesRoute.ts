import { createRoute } from '@tanstack/react-router'

import { ROLE } from '@locale/shared'

import RouteError from '@/components/RouteError/RouteError'
import { ForbiddenError } from '@/lib/forbiddenError'
import { authenticatedRoute } from '@/routes/authenticatedRoute'

export const languagesRoute = createRoute({
	getParentRoute: () => authenticatedRoute,
	path: '/languages',
	beforeLoad: ({ context }) => {
		if (context.user.role !== ROLE.ADMIN) {
			throw new ForbiddenError()
		}
	},
	// Stays eager: the 403 page must render from the guard without waiting for the page chunk.
	errorComponent: RouteError,
}).lazy(() => import('@/routes/languagesRoute.lazy').then((module) => module.Route))
