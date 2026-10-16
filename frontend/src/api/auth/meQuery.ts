import { queryOptions, useQuery } from '@tanstack/react-query'

import { type AuthUser } from '@locale/shared'

import http from '@/api/http'
import { QUERY_KEYS } from '@/api/queryKeys'

/** The signed-in user. Loaded by the route guards; stays cached until logout or a 401 clears it. */
export const meQueryOptions = queryOptions({
	queryKey: QUERY_KEYS.AUTH.ME(),
	queryFn: async () => (await http.get<AuthUser>('/auth/me')).data,
	staleTime: Infinity,
})

export const useMeQuery = () => useQuery(meQueryOptions)
