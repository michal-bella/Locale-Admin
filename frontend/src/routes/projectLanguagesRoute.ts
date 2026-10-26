import { createRoute } from '@tanstack/react-router'

import { PROJECT_ROLE } from '@locale/shared'

import { fetchProjectRole } from '@/api/projects/projectsQuery'
import RouteError from '@/components/RouteError/RouteError'
import { ForbiddenError } from '@/lib/forbiddenError'
import { projectRoute } from '@/routes/projectRoute'

export const projectLanguagesRoute = createRoute({
	getParentRoute: () => projectRoute,
	path: '/languages',
	// A VISITOR only reads translations; the API lets them read these pages' data, so the block is here (see docs/plans/visitor-role.md).
	// An unknown slug passes: the project route answers it with 404.
	beforeLoad: async ({ context, params }) => {
		if ((await fetchProjectRole(context.queryClient, params.projectSlug)) === PROJECT_ROLE.VISITOR) {
			throw new ForbiddenError()
		}
	},
	// Stays eager: the 403 page must render from the guard without waiting for the page chunk.
	errorComponent: RouteError,
}).lazy(() => import('@/routes/projectLanguagesRoute.lazy').then((module) => module.Route))
