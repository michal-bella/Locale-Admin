import { createRoute, redirect } from '@tanstack/react-router'

import { projectRoute } from '@/routes/projectRoute'

/** A project has no overview page yet, it opens on its translations. */
export const projectIndexRoute = createRoute({
	getParentRoute: () => projectRoute,
	path: '/',
	beforeLoad: ({ params }) => {
		redirect({ to: '/projects/$projectSlug/translations', params, replace: true, throw: true })
	},
})
