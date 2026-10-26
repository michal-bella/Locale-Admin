import { useQuery } from '@tanstack/react-query'

import { type AuthProvidersResponse } from '@locale/shared'

import http from '@/api/http'
import { QUERY_KEYS } from '@/api/queryKeys'

/** Sign-in methods besides the password; the backend configuration does not change while the page is open. */
export const useAuthProvidersQuery = () =>
	useQuery({
		queryKey: QUERY_KEYS.AUTH.PROVIDERS(),
		queryFn: async () => (await http.get<AuthProvidersResponse>('/auth/providers')).data,
		staleTime: Infinity,
		retry: false,
	})
