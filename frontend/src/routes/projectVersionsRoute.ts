import { createRoute } from '@tanstack/react-router'

import { PROJECT_ROLE } from '@locale/shared'

import { fetchProjectRole } from '@/api/projects/projectsQuery'
import RouteError from '@/components/RouteError/RouteError'
import { ForbiddenError } from '@/lib/forbiddenError'
import { projectRoute } from '@/routes/projectRoute'

export const projectVersionsRoute = createRoute({
	getParentRoute: () => projectRoute,
	path: '/versions',
	// Same block as the other project pages: a VISITOR has Preklady and Prehľad only (see docs/plans/visitor-role.md).
	// An unknown slug passes: the project route answers it with 404.
	beforeLoad: async ({ context, params }) => {
		if ((await fetchProjectRole(context.queryClient, params.projectSlug)) === PROJECT_ROLE.VISITOR) {
			throw new ForbiddenError()
		}
	},
	errorComponent: RouteError,
}).lazy(() => import('@/routes/projectVersionsRoute.lazy').then((module) => module.Route))
