import { createRoute } from '@tanstack/react-router'

import AppLayout from '@/components/AppLayout/AppLayout'
import { authenticatedRoute } from '@/routes/authenticatedRoute'

/** Pages with the sidebar: a project, the profile and the admin pages. */
export const appLayoutRoute = createRoute({
	getParentRoute: () => authenticatedRoute,
	id: '_app',
	component: AppLayout,
})
