import { queryOptions, useQuery } from '@tanstack/react-query'

import { type LanguagesResponse } from '@locale/shared'

import http from '@/api/http'
import { QUERY_KEYS } from '@/api/queryKeys'

/** Languages of the project, the base language first, then by tag. */
export const projectLanguagesQueryOptions = (projectId: string) =>
	queryOptions({
		queryKey: QUERY_KEYS.PROJECTS.LANGUAGES(projectId),
		queryFn: async () => (await http.get<LanguagesResponse>(`/projects/${projectId}/languages`)).data,
	})

export const useProjectLanguagesQuery = (projectId: string) => useQuery(projectLanguagesQueryOptions(projectId))
