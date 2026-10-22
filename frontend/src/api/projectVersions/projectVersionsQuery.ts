import { queryOptions, useQuery } from '@tanstack/react-query'

import { type ProjectVersionsResponse } from '@locale/shared'

import http from '@/api/http'
import { QUERY_KEYS } from '@/api/queryKeys'

/** Versions of the project, newest `startsAt` first, with `isLocked`, `state` and `isCurrent` computed by the backend for today. */
export const projectVersionsQueryOptions = (projectId: string) =>
	queryOptions({
		queryKey: QUERY_KEYS.PROJECTS.VERSIONS(projectId),
		queryFn: async () => (await http.get<ProjectVersionsResponse>(`/projects/${projectId}/versions`)).data,
	})

export const useProjectVersionsQuery = (projectId: string) => useQuery(projectVersionsQueryOptions(projectId))
