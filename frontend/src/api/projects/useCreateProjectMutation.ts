import { useMutation, useQueryClient } from '@tanstack/react-query'

import { type CreateProjectRequest, type ProjectListItem } from '@locale/shared'

import http from '@/api/http'
import { QUERY_KEYS } from '@/api/queryKeys'

export const useCreateProjectMutation = () => {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (body: CreateProjectRequest) => (await http.post<ProjectListItem>('/projects', body)).data,
		onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PROJECTS.LIST() }),
	})
}
