import { queryOptions, useQuery } from '@tanstack/react-query'

import { type DashboardResponse } from '@locale/shared'

import http from '@/api/http'
import { QUERY_KEYS } from '@/api/queryKeys'

export const dashboardQueryOptions = (projectId: string) =>
	queryOptions({
		queryKey: QUERY_KEYS.PROJECTS.DASHBOARD(projectId),
		queryFn: async () => (await http.get<DashboardResponse>(`/projects/${projectId}/dashboard`)).data,
	})

export const useDashboardQuery = (projectId: string) => useQuery(dashboardQueryOptions(projectId))
