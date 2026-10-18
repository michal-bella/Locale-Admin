import { createRoute, notFound, Outlet } from '@tanstack/react-router'

import { ERROR_CODE, type ProjectListResponse } from '@locale/shared'

import getApiErrorCode from '@/api/getApiErrorCode'
import { projectSettingsQueryOptions } from '@/api/projectSettings/projectSettingsQuery'
import { projectsQueryOptions } from '@/api/projects/projectsQuery'
import RouteError from '@/components/RouteError/RouteError'
import ProjectNotFoundPage from '@/pages/ProjectNotFoundPage/ProjectNotFoundPage'
import { appLayoutRoute } from '@/routes/appLayoutRoute'

const findProjectId = ({ projects }: ProjectListResponse, slug: string) => projects.find((project) => project.slug === slug)?.id

/**
 * A project the user can open (member or ADMIN), addressed by its slug. The API stays on ids: the slug is resolved through the
 * project list, which holds exactly the projects the user may open, so anything else is shown as not found inside the layout.
 */
export const projectRoute = createRoute({
	getParentRoute: () => appLayoutRoute,
	path: '/projects/$projectSlug',
	loader: async ({ context: { queryClient }, params: { projectSlug } }) => {
		// A project created or renamed after the list was cached is not in it yet, so a miss refetches once before the 404.
		const projectId =
			findProjectId(await queryClient.ensureQueryData(projectsQueryOptions), projectSlug) ??
			findProjectId(await queryClient.fetchQuery({ ...projectsQueryOptions, staleTime: 0 }), projectSlug)
		if (!projectId) {
			// notFound({ throw: true }) would not narrow projectId; the thrown value is TanStack's control-flow object, as in its docs.
			// eslint-disable-next-line @typescript-eslint/only-throw-error
			throw notFound()
		}
		try {
			// No retries: a 404 is the answer, not a glitch, and the not-found page should not wait for the backoff.
			await queryClient.ensureQueryData({ ...projectSettingsQueryOptions(projectId), retry: false })
		} catch (error) {
			if (getApiErrorCode(error) === ERROR_CODE.NOT_FOUND) {
				notFound({ throw: true })
			}
			throw error
		}
		return { projectId }
	},
	component: Outlet,
	notFoundComponent: ProjectNotFoundPage,
	errorComponent: RouteError,
})
