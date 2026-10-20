import { useMutation, useQueryClient } from '@tanstack/react-query'

import { ERROR_CODE } from '@locale/shared'

import { invalidateDashboard } from '@/api/dashboard/invalidateDashboard'
import getApiErrorCode from '@/api/getApiErrorCode'
import http from '@/api/http'
import { QUERY_KEYS } from '@/api/queryKeys'

/** Removes the user from a project from the user detail (`DELETE /projects/:projectId/members/:userId`). Refetches the users (the open detail is under that prefix), the admin projects and the project's members. */
export const useRemoveUserProjectMutation = (userId: string) => {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (projectId: string) => {
			await http.delete(`/projects/${projectId}/members/${userId}`)
		},
		onSuccess: (_result, projectId) =>
			Promise.all([
				queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ADMIN.USERS() }),
				queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ADMIN.PROJECTS() }),
				queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PROJECTS.MEMBERS(projectId) }),
				invalidateDashboard(queryClient, projectId),
			]),
		onError: (error) => {
			// Already removed by someone else: the table must drop the row.
			if (getApiErrorCode(error) === ERROR_CODE.NOT_FOUND) {
				void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ADMIN.USER(userId) })
			}
		},
	})
}
