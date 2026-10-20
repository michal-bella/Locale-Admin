import { useMutation, useQueryClient } from '@tanstack/react-query'

import { type ProjectSettings, type UpdateProjectSettingsRequest } from '@locale/shared'

import { invalidateDashboard } from '@/api/dashboard/invalidateDashboard'
import http from '@/api/http'
import { QUERY_KEYS } from '@/api/queryKeys'

export const useUpdateProjectSettingsMutation = (projectId: string) => {
	const queryClient = useQueryClient()

	return useMutation({
		// Lets the edit modal on Projekty see the save in progress, the form owns the mutation.
		mutationKey: QUERY_KEYS.PROJECTS.SETTINGS(projectId),
		mutationFn: async (body: UpdateProjectSettingsRequest) => (await http.patch<ProjectSettings>(`/projects/${projectId}/settings`, body)).data,
		// A new base language moves the base badge on the project's Languages page; name and color show in the project lists.
		onSuccess: () =>
			Promise.all([
				queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PROJECTS.SETTINGS(projectId) }),
				queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PROJECTS.LIST() }),
				queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PROJECTS.LANGUAGES(projectId) }),
				queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ADMIN.PROJECTS() }),
				invalidateDashboard(queryClient, projectId),
			]),
	})
}
