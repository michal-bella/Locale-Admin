import { queryOptions, useQuery } from '@tanstack/react-query'

import { type ProjectSettings } from '@locale/shared'

import http from '@/api/http'
import { QUERY_KEYS } from '@/api/queryKeys'

/** Settings of the single project (`GET /api/admin/project`). */
export const projectSettingsQueryOptions = queryOptions({
	queryKey: QUERY_KEYS.PROJECT_SETTINGS(),
	queryFn: async () => (await http.get<ProjectSettings>('/admin/project')).data,
})

export const useProjectSettingsQuery = () => useQuery(projectSettingsQueryOptions)
