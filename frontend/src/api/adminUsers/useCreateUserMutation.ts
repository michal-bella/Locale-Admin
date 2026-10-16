import { useMutation, useQueryClient } from '@tanstack/react-query'

import { type AdminUser, type CreateUserRequest } from '@locale/shared'

import http from '@/api/http'
import { QUERY_KEYS } from '@/api/queryKeys'

export const useCreateUserMutation = () => {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (body: CreateUserRequest) => (await http.post<AdminUser>('/admin/users', body)).data,
		// Awaited so the mutation stays pending until the list is refetched and the new row is there when the modal closes.
		onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ADMIN.USERS() }),
	})
}
