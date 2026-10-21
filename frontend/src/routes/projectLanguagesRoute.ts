import { createRoute } from '@tanstack/react-router'

import { ROLE } from '@locale/shared'

import RouteError from '@/components/RouteError/RouteError'
import { ForbiddenError } from '@/lib/forbiddenError'
import { projectRoute } from '@/routes/projectRoute'

export const projectLanguagesRoute = createRoute({
	getParentRoute: () => projectRoute,
	path: '/languages',
	// A VISITOR only reads translations; the API lets them read these pages' data, so the block is here (see docs/plans/visitor-role.md).
	beforeLoad: ({ context }) => {
		if (context.user.role === ROLE.VISITOR) {
			throw new ForbiddenError()
		}
	},
	// Stays eager: the 403 page must render from the guard without waiting for the page chunk.
	errorComponent: RouteError,
}).lazy(() => import('@/routes/projectLanguagesRoute.lazy').then((module) => module.Route))
