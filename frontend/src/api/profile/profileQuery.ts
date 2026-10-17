import { queryOptions, useQuery } from '@tanstack/react-query'

import { type Profile } from '@locale/shared'

import http from '@/api/http'
import { QUERY_KEYS } from '@/api/queryKeys'

/** Profile of the signed-in user (`GET /api/profile`). */
export const profileQueryOptions = queryOptions({
	queryKey: QUERY_KEYS.PROFILE(),
	queryFn: async () => (await http.get<Profile>('/profile')).data,
})

export const useProfileQuery = () => useQuery(profileQueryOptions)
