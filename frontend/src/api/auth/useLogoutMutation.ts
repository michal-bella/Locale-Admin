import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'

import http from '@/api/http'

export const useLogoutMutation = () => {
	const queryClient = useQueryClient()
	const navigate = useNavigate()

	return useMutation({
		mutationFn: async () => {
			await http.post('/auth/logout')
		},
		// Clear before navigating: the /login guard would otherwise find the cached user and redirect back to /.
		onSuccess: async () => {
			queryClient.clear()
			await navigate({ to: '/login' })
		},
	})
}
