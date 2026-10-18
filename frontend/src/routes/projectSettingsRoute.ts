import { createRoute } from '@tanstack/react-router'

import { projectRoute } from '@/routes/projectRoute'

export const projectSettingsRoute = createRoute({
	getParentRoute: () => projectRoute,
	path: '/settings',
}).lazy(() => import('@/routes/projectSettingsRoute.lazy').then((module) => module.Route))
