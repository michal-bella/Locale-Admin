import { createRoute } from '@tanstack/react-router'

import HomeLayout from '@/components/HomeLayout/HomeLayout'
import { authenticatedRoute } from '@/routes/authenticatedRoute'

/** The project list has no sidebar: there is no project selected yet. */
export const homeLayoutRoute = createRoute({
	getParentRoute: () => authenticatedRoute,
	id: '_home',
	component: HomeLayout,
})
