import { useMutation, useQueryClient } from '@tanstack/react-query'

import http from '@/api/http'
import { QUERY_KEYS } from '@/api/queryKeys'

export const useLeaveProjectMutation = () => {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (projectId: string) => {
			await http.delete(`/projects/${projectId}/membership`)
		},
		// A member loses access, so cached settings and members must not open the project again from the cache.
		onSuccess: (_data, projectId) => {
			queryClient.removeQueries({ queryKey: QUERY_KEYS.PROJECTS.DETAIL(projectId) })
			return queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PROJECTS.LIST() })
		},
	})
}
