import { useMutation, useQueryClient } from '@tanstack/react-query'

import { ERROR_CODE } from '@locale/shared'

import getApiErrorCode from '@/api/getApiErrorCode'
import http from '@/api/http'
import { QUERY_KEYS } from '@/api/queryKeys'

export const useRemoveProjectMemberMutation = (projectId: string) => {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (userId: string) => {
			await http.delete(`/projects/${projectId}/members/${userId}`)
		},
		onSuccess: () =>
			Promise.all([
				queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PROJECTS.MEMBERS(projectId) }),
				queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ADMIN.USERS() }),
			]),
		onError: (error) => {
			// Already removed by someone else: the list must drop the row.
			if (getApiErrorCode(error) === ERROR_CODE.NOT_FOUND) {
				void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PROJECTS.MEMBERS(projectId) })
			}
		},
	})
}
