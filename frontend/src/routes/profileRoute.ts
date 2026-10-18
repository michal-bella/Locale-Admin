import { createRoute } from '@tanstack/react-router'

import { appLayoutRoute } from '@/routes/appLayoutRoute'

export const profileRoute = createRoute({
	getParentRoute: () => appLayoutRoute,
	path: '/profile',
}).lazy(() => import('@/routes/profileRoute.lazy').then((module) => module.Route))
