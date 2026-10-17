import { useMutation, useQueryClient } from '@tanstack/react-query'

import { type AuthUser, type Profile, type UpdateProfileRequest } from '@locale/shared'

import http from '@/api/http'
import { QUERY_KEYS } from '@/api/queryKeys'

export const useUpdateProfileMutation = () => {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (body: UpdateProfileRequest) => (await http.patch<Profile>('/profile', body)).data,
		onSuccess: (profile) => {
			queryClient.setQueryData<Profile>(QUERY_KEYS.PROFILE(), profile)
			// `me` has `staleTime: Infinity`; writing it directly updates the top-bar initials without another request.
			const { id, email, role, firstName, lastName } = profile
			queryClient.setQueryData<AuthUser>(QUERY_KEYS.AUTH.ME(), { id, email, role, firstName, lastName })
		},
	})
}
