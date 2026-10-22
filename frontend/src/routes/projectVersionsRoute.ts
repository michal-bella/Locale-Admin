import { createRoute } from '@tanstack/react-router'

import { ROLE } from '@locale/shared'

import RouteError from '@/components/RouteError/RouteError'
import { ForbiddenError } from '@/lib/forbiddenError'
import { projectRoute } from '@/routes/projectRoute'

export const projectVersionsRoute = createRoute({
	getParentRoute: () => projectRoute,
	path: '/versions',
	// Same block as the other project pages: a VISITOR has Preklady and Prehľad only (see docs/plans/visitor-role.md).
	beforeLoad: ({ context }) => {
		if (context.user.role === ROLE.VISITOR) {
			throw new ForbiddenError()
		}
	},
	errorComponent: RouteError,
}).lazy(() => import('@/routes/projectVersionsRoute.lazy').then((module) => module.Route))
