import { useMutation, useQueryClient } from '@tanstack/react-query'

import { ERROR_CODE } from '@locale/shared'

import getApiErrorCode from '@/api/getApiErrorCode'
import http from '@/api/http'
import { QUERY_KEYS } from '@/api/queryKeys'

export const useDeleteProjectMutation = () => {
	const queryClient = useQueryClient()

	const refreshLists = () =>
		Promise.all([
			queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ADMIN.PROJECTS() }),
			queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PROJECTS.LIST() }),
		])

	return useMutation({
		mutationFn: async (projectId: string) => {
			await http.delete(`/admin/projects/${projectId}`)
		},
		// Cached settings, languages and members must not open the deleted project again from the cache.
		onSuccess: (_data, projectId) => {
			queryClient.removeQueries({ queryKey: QUERY_KEYS.PROJECTS.DETAIL(projectId) })
			return refreshLists()
		},
		onError: (error, projectId) => {
			// Already deleted by another admin: the lists must drop the row.
			if (getApiErrorCode(error) === ERROR_CODE.NOT_FOUND) {
				queryClient.removeQueries({ queryKey: QUERY_KEYS.PROJECTS.DETAIL(projectId) })
				void refreshLists()
			}
		},
	})
}
