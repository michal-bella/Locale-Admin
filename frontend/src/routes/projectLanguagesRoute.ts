import { createRoute } from '@tanstack/react-router'

import { projectRoute } from '@/routes/projectRoute'

export const projectLanguagesRoute = createRoute({
	getParentRoute: () => projectRoute,
	path: '/languages',
}).lazy(() => import('@/routes/projectLanguagesRoute.lazy').then((module) => module.Route))
