import { createRoute, notFound, Outlet } from '@tanstack/react-router'

import { ERROR_CODE } from '@locale/shared'

import getApiErrorCode from '@/api/getApiErrorCode'
import { projectSettingsQueryOptions } from '@/api/projectSettings/projectSettingsQuery'
import RouteError from '@/components/RouteError/RouteError'
import ProjectNotFoundPage from '@/pages/ProjectNotFoundPage/ProjectNotFoundPage'
import { appLayoutRoute } from '@/routes/appLayoutRoute'

/** A project the user can open (member or ADMIN). The BE answers 404 for anyone else, shown inside the layout. */
export const projectRoute = createRoute({
	getParentRoute: () => appLayoutRoute,
	path: '/projects/$projectId',
	loader: async ({ context, params }) => {
		try {
			// No retries: a 404 is the answer, not a glitch, and the not-found page should not wait for the backoff.
			await context.queryClient.ensureQueryData({ ...projectSettingsQueryOptions(params.projectId), retry: false })
		} catch (error) {
			if (getApiErrorCode(error) === ERROR_CODE.NOT_FOUND) {
				notFound({ throw: true })
			}
			throw error
		}
	},
	component: Outlet,
	notFoundComponent: ProjectNotFoundPage,
	errorComponent: RouteError,
})
