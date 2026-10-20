import { createRoute } from '@tanstack/react-router'

import { projectRoute } from '@/routes/projectRoute'

export const projectDashboardRoute = createRoute({
	getParentRoute: () => projectRoute,
	path: '/dashboard',
}).lazy(() => import('@/routes/projectDashboardRoute.lazy').then((module) => module.Route))
