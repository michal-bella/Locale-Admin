import { queryOptions, useQuery } from '@tanstack/react-query'

import { type AdminUserListResponse } from '@locale/shared'

import http from '@/api/http'
import { QUERY_KEYS } from '@/api/queryKeys'

/** All users for the admin list, newest first. */
export const adminUsersQueryOptions = queryOptions({
	queryKey: QUERY_KEYS.ADMIN.USERS(),
	queryFn: async () => (await http.get<AdminUserListResponse>('/admin/users')).data,
})

export const useAdminUsersQuery = (enabled = true) => useQuery({ ...adminUsersQueryOptions, enabled })
