import { useMutation, useQueryClient } from '@tanstack/react-query'

import { type AuthUser, type Profile, type UpdatePreferencesRequest } from '@locale/shared'

import http from '@/api/http'
import { QUERY_KEYS } from '@/api/queryKeys'

/**
 * `PATCH /api/profile/preferences`. The `me` cache (`staleTime: Infinity`) switches optimistically, so the translations page
 * re-renders in the new view at once; on error the previous value comes back and the server's profile wins on success.
 */
export const useUpdatePreferencesMutation = () => {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (body: UpdatePreferencesRequest) => (await http.patch<Profile>('/profile/preferences', body)).data,
		onMutate: async (body) => {
			await queryClient.cancelQueries({ queryKey: QUERY_KEYS.AUTH.ME() })
			const previous = queryClient.getQueryData<AuthUser>(QUERY_KEYS.AUTH.ME())
			queryClient.setQueryData<AuthUser>(QUERY_KEYS.AUTH.ME(), (current) => current && { ...current, preferences: { ...current.preferences, ...body } })
			return { previous }
		},
		onError: (_error, _body, context) => {
			if (context?.previous) {
				queryClient.setQueryData(QUERY_KEYS.AUTH.ME(), context.previous)
			}
		},
		onSuccess: (profile) => {
			queryClient.setQueryData<Profile>(QUERY_KEYS.PROFILE(), profile)
			const { id, email, role, firstName, lastName, preferences } = profile
			queryClient.setQueryData<AuthUser>(QUERY_KEYS.AUTH.ME(), { id, email, role, firstName, lastName, preferences })
		},
	})
}
