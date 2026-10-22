import { useMutation, useQueryClient } from '@tanstack/react-query'

import { type ProjectVersion, type UpdateProjectVersionRequest } from '@locale/shared'

import http from '@/api/http'
import { QUERY_KEYS } from '@/api/queryKeys'

/** Rename, move the dates or lock / unlock a version. The translations list shows the version name in its chips, so it is refetched too. */
export const useUpdateProjectVersionMutation = (projectId: string) => {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async ({ versionId, ...body }: UpdateProjectVersionRequest & { versionId: string }) =>
			(await http.patch<ProjectVersion>(`/projects/${projectId}/versions/${versionId}`, body)).data,
		onSuccess: () =>
			Promise.all([
				queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PROJECTS.VERSIONS(projectId) }),
				queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PROJECTS.TRANSLATIONS_ALL(projectId) }),
			]),
	})
}
