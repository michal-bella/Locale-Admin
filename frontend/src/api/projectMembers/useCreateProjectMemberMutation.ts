import { useMutation, useQueryClient } from '@tanstack/react-query'

import { type CreateProjectMemberRequest, type ProjectMember } from '@locale/shared'

import http from '@/api/http'
import { QUERY_KEYS } from '@/api/queryKeys'

export const useCreateProjectMemberMutation = (projectId: string) => {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (body: CreateProjectMemberRequest) => (await http.post<ProjectMember>(`/projects/${projectId}/members`, body)).data,
		onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PROJECTS.MEMBERS(projectId) }),
	})
}
