import { type QueryClient, queryOptions, useQuery } from '@tanstack/react-query'

import { type ProjectAccessRole, type ProjectListResponse } from '@locale/shared'

import http from '@/api/http'
import { QUERY_KEYS } from '@/api/queryKeys'

export const projectsQueryOptions = queryOptions({
	queryKey: QUERY_KEYS.PROJECTS.LIST(),
	queryFn: async () => (await http.get<ProjectListResponse>('/projects')).data,
})

export const useProjectsQuery = () => useQuery(projectsQueryOptions)

/** For route guards: the user's role in the project with this slug, from the cached list, refetched on a slug miss; `undefined` for a project the user cannot open. */
export const fetchProjectRole = async (queryClient: QueryClient, projectSlug: string): Promise<ProjectAccessRole | undefined> => {
	const findRole = ({ projects }: ProjectListResponse) => projects.find((project) => project.slug === projectSlug)?.myRole
	return (
		findRole(await queryClient.query({ ...projectsQueryOptions, staleTime: 'static' })) ??
		findRole(await queryClient.query({ ...projectsQueryOptions, staleTime: 0 }))
	)
}
