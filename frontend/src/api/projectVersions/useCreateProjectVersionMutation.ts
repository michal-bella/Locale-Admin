import { useMutation, useQueryClient } from '@tanstack/react-query'

import { type CreateProjectVersionRequest, type ProjectVersion } from '@locale/shared'

import http from '@/api/http'
import { QUERY_KEYS } from '@/api/queryKeys'

export const useCreateProjectVersionMutation = (projectId: string) => {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (body: CreateProjectVersionRequest) => (await http.post<ProjectVersion>(`/projects/${projectId}/versions`, body)).data,
		onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PROJECTS.VERSIONS(projectId) }),
	})
}
