import { queryOptions, useQuery } from '@tanstack/react-query'

import { type ProjectListResponse } from '@locale/shared'

import http from '@/api/http'
import { QUERY_KEYS } from '@/api/queryKeys'

export const projectsQueryOptions = queryOptions({
	queryKey: QUERY_KEYS.PROJECTS.LIST(),
	queryFn: async () => (await http.get<ProjectListResponse>('/projects')).data,
})

export const useProjectsQuery = () => useQuery(projectsQueryOptions)
