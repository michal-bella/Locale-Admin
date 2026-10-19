import { queryOptions, useQuery } from '@tanstack/react-query'

import { type AdminUserDetail } from '@locale/shared'

import http from '@/api/http'
import { retryUnlessNotFound } from '@/api/queryClient'
import { QUERY_KEYS } from '@/api/queryKeys'

/** One user with their projects for the user detail. A 404 is the answer (unknown or deleted user), so it is not retried. */
export const adminUserQueryOptions = (userId: string) =>
	queryOptions({
		queryKey: QUERY_KEYS.ADMIN.USER(userId),
		queryFn: async () => (await http.get<AdminUserDetail>(`/admin/users/${userId}`)).data,
		retry: retryUnlessNotFound,
	})

export const useAdminUserQuery = (userId: string) => useQuery(adminUserQueryOptions(userId))
