import { createRoute } from '@tanstack/react-router'

import { authenticatedRoute } from '@/routes/authenticatedRoute'

export const profileRoute = createRoute({
	getParentRoute: () => authenticatedRoute,
	path: '/profile',
}).lazy(() => import('@/routes/profileRoute.lazy').then((module) => module.Route))
