import { createRoute } from '@tanstack/react-router'

import HomePage from '@/pages/HomePage/HomePage'
import { authenticatedRoute } from '@/routes/authenticatedRoute'

export const indexRoute = createRoute({
	getParentRoute: () => authenticatedRoute,
	path: '/',
	component: HomePage,
})
