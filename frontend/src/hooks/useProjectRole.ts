import { useQuery } from '@tanstack/react-query'

import { type ProjectAccessRole } from '@locale/shared'

import { projectsQueryOptions } from '@/api/projects/projectsQuery'

/** The user's role in the project (`myRole` of the project list); `undefined` until the list is loaded. */
export const useProjectRole = (projectId: string | undefined): ProjectAccessRole | undefined => {
	// Only reads the cache: the project route loads the list, a refetch on every page would only repeat it.
	const { data } = useQuery({ ...projectsQueryOptions, enabled: false })
	return data?.projects.find((project) => project.id === projectId)?.myRole
}
