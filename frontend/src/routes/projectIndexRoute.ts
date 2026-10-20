import { createRoute, redirect } from '@tanstack/react-router'

import { projectRoute } from '@/routes/projectRoute'

/** A project opens on its translations, the core of the app; Prehľad is a separate page in the sidebar. */
export const projectIndexRoute = createRoute({
	getParentRoute: () => projectRoute,
	path: '/',
	beforeLoad: ({ params }) => {
		redirect({ to: '/projects/$projectSlug/translations', params, replace: true, throw: true })
	},
})
