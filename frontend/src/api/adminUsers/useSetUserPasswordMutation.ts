import { useMutation, useQueryClient } from '@tanstack/react-query'

import { type AdminUserDetail, type SetUserPasswordRequest } from '@locale/shared'

import http from '@/api/http'
import { QUERY_KEYS } from '@/api/queryKeys'

/** `PUT /admin/users/:id/password`: a new password of a user, who is signed out everywhere. */
export const useSetUserPasswordMutation = (userId: string) => {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (body: SetUserPasswordRequest) => (await http.put<AdminUserDetail>(`/admin/users/${userId}/password`, body)).data,
		onSuccess: (user) => {
			queryClient.setQueryData<AdminUserDetail>(QUERY_KEYS.ADMIN.USER(userId), user)
			return queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ADMIN.USERS(), exact: true })
		},
	})
}
