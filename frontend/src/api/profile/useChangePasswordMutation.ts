import { useMutation, useQueryClient } from '@tanstack/react-query'

import { type ChangePasswordRequest, type Profile } from '@locale/shared'

import http from '@/api/http'
import { QUERY_KEYS } from '@/api/queryKeys'

export const useChangePasswordMutation = () => {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (body: ChangePasswordRequest) => (await http.put<Profile>('/profile/password', body)).data,
		onSuccess: (profile) => {
			queryClient.setQueryData<Profile>(QUERY_KEYS.PROFILE(), profile)
		},
	})
}
