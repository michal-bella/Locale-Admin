import { queryOptions, useQuery } from '@tanstack/react-query'

import { type AdminProjectListResponse } from '@locale/shared'

import http from '@/api/http'
import { QUERY_KEYS } from '@/api/queryKeys'

export const adminProjectsQueryOptions = queryOptions({
	queryKey: QUERY_KEYS.ADMIN.PROJECTS(),
	queryFn: async () => (await http.get<AdminProjectListResponse>('/admin/projects')).data,
})

export const useAdminProjectsQuery = () => useQuery(adminProjectsQueryOptions)
