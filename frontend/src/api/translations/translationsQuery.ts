import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query'

import { type TranslationsQueryInput, type TranslationsResponse } from '@locale/shared'

import http from '@/api/http'
import { QUERY_KEYS } from '@/api/queryKeys'

export const translationsQueryOptions = (projectId: string, query: TranslationsQueryInput) =>
	queryOptions({
		queryKey: QUERY_KEYS.PROJECTS.TRANSLATIONS(projectId, query),
		queryFn: async () => (await http.get<TranslationsResponse>(`/projects/${projectId}/translations`, { params: query })).data,
	})

/**
 * One page of keys for the source and target language. `query` is `null` until the languages are known. The previous page stays
 * on screen while the next one loads, so the table does not flash skeletons on every filter change.
 */
export const useTranslationsQuery = (projectId: string, query: TranslationsQueryInput | null) =>
	useQuery({
		...translationsQueryOptions(projectId, query ?? { sourceLanguageId: '', targetLanguageId: '', versionId: '' }),
		enabled: query !== null,
		placeholderData: keepPreviousData,
	})
