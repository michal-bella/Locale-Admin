import { createRoute } from '@tanstack/react-router'

import { projectRoute } from '@/routes/projectRoute'

export const projectMembersRoute = createRoute({
	getParentRoute: () => projectRoute,
	path: '/members',
}).lazy(() => import('@/routes/projectMembersRoute.lazy').then((module) => module.Route))
