import { useMutation, useQueryClient } from '@tanstack/react-query'

import { invalidateDashboard } from '@/api/dashboard/invalidateDashboard'
import http from '@/api/http'
import { QUERY_KEYS } from '@/api/queryKeys'

/** Deletes a version with its keys and cells (not the current one: 409 `PROJECT_VERSION_CURRENT`); the diff summaries live under `VERSIONS`, so they are refetched too. */
export const useDeleteProjectVersionMutation = (projectId: string) => {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (versionId: string) => {
			await http.delete(`/projects/${projectId}/versions/${versionId}`)
		},
		onSuccess: () =>
			Promise.all([
				queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PROJECTS.VERSIONS(projectId) }),
				queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PROJECTS.TRANSLATIONS_ALL(projectId) }),
				invalidateDashboard(queryClient, projectId),
			]),
	})
}
