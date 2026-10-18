import { queryOptions, useQuery } from '@tanstack/react-query'

import { type ProjectSettings } from '@locale/shared'

import http from '@/api/http'
import { QUERY_KEYS } from '@/api/queryKeys'

export const projectSettingsQueryOptions = (projectId: string) =>
	queryOptions({
		queryKey: QUERY_KEYS.PROJECTS.SETTINGS(projectId),
		queryFn: async () => (await http.get<ProjectSettings>(`/projects/${projectId}/settings`)).data,
	})

export const useProjectSettingsQuery = (projectId: string) => useQuery(projectSettingsQueryOptions(projectId))
