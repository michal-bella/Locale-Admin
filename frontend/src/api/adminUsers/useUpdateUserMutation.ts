import { useMutation, useQueryClient } from '@tanstack/react-query'

import { type AdminUserDetail, type AuthUser, type UpdateUserRequest } from '@locale/shared'

import http from '@/api/http'
import { QUERY_KEYS } from '@/api/queryKeys'

/** `PATCH /admin/users/:id`: the role and/or the email of a user. */
export const useUpdateUserMutation = (userId: string) => {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (body: UpdateUserRequest) => (await http.patch<AdminUserDetail>(`/admin/users/${userId}`, body)).data,
		onSuccess: (user) => {
			queryClient.setQueryData<AdminUserDetail>(QUERY_KEYS.ADMIN.USER(userId), user)
			// The admin may have changed their own account; `me` has `staleTime: Infinity`, so the top bar and guards read it from here.
			queryClient.setQueryData<AuthUser>(QUERY_KEYS.AUTH.ME(), (me) => (me && me.id === user.id ? { ...me, role: user.role, email: user.email } : me))
			// The email shows up in project member lists too.
			return Promise.all([
				queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ADMIN.USERS(), exact: true }),
				queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PROJECTS.ALL() }),
			])
		},
	})
}
