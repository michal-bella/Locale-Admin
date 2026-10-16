import { createRoute } from '@tanstack/react-router'

import HomePage from '@/pages/HomePage/HomePage'
import { rootRoute } from '@/routes/rootRoute'

export const indexRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/',
	component: HomePage,
})
