import { createRoute, redirect } from '@tanstack/react-router'

import { projectRoute } from '@/routes/projectRoute'

/** A project has no overview page yet. */
export const projectIndexRoute = createRoute({
	getParentRoute: () => projectRoute,
	path: '/',
	beforeLoad: ({ params }) => {
		redirect({ to: '/projects/$projectId/settings', params, replace: true, throw: true })
	},
})
