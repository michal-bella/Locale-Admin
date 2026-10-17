import { useMutation, useQueryClient } from '@tanstack/react-query'

import { type ProjectSettings, type UpdateProjectSettingsRequest } from '@locale/shared'

import http from '@/api/http'
import { QUERY_KEYS } from '@/api/queryKeys'

export const useUpdateProjectSettingsMutation = () => {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (body: UpdateProjectSettingsRequest) => (await http.patch<ProjectSettings>('/admin/project', body)).data,
		// A new base language moves the base flag on the Languages page too.
		onSuccess: () =>
			Promise.all([
				queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PROJECT_SETTINGS() }),
				queryClient.invalidateQueries({ queryKey: QUERY_KEYS.LANGUAGES() }),
			]),
	})
}
