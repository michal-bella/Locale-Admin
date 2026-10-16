import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'

import { type AuthUser, type LoginRequest } from '@locale/shared'

import http from '@/api/http'
import { QUERY_KEYS } from '@/api/queryKeys'

export const useLoginMutation = () => {
	const queryClient = useQueryClient()
	const navigate = useNavigate()

	return useMutation({
		mutationFn: async (body: LoginRequest) => (await http.post<AuthUser>('/auth/login', body)).data,
		onSuccess: async (user) => {
			queryClient.setQueryData(QUERY_KEYS.AUTH.ME(), user)
			await navigate({ to: '/' })
		},
	})
}
