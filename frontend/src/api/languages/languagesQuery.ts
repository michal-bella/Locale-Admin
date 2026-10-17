import { queryOptions, useQuery } from '@tanstack/react-query'

import { type LanguagesResponse } from '@locale/shared'

import http from '@/api/http'
import { QUERY_KEYS } from '@/api/queryKeys'

/** All languages, the base language first, then by tag. */
export const languagesQueryOptions = queryOptions({
	queryKey: QUERY_KEYS.LANGUAGES(),
	queryFn: async () => (await http.get<LanguagesResponse>('/admin/languages')).data,
})

export const useLanguagesQuery = () => useQuery(languagesQueryOptions)
