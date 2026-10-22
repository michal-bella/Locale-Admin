import { queryOptions, useQuery } from '@tanstack/react-query'

import { type DashboardQuery, type DashboardResponse } from '@locale/shared'

import http from '@/api/http'
import { QUERY_KEYS } from '@/api/queryKeys'

export const dashboardQueryOptions = (projectId: string, query: DashboardQuery) =>
	queryOptions({
		queryKey: QUERY_KEYS.PROJECTS.DASHBOARD(projectId, query),
		queryFn: async () => (await http.get<DashboardResponse>(`/projects/${projectId}/dashboard`, { params: query })).data,
	})

/** The numbers of one version of the project; without `versionId` the backend answers for the current version (else the newest). */
export const useDashboardQuery = (projectId: string, query: DashboardQuery = {}) => useQuery(dashboardQueryOptions(projectId, query))
