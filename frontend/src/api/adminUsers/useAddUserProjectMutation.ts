import { useMutation, useQueryClient } from '@tanstack/react-query'

import { ERROR_CODE, type PROJECT_ROLE, type ProjectMember } from '@locale/shared'

import { invalidateDashboard } from '@/api/dashboard/invalidateDashboard'
import getApiErrorCode from '@/api/getApiErrorCode'
import http from '@/api/http'
import { QUERY_KEYS } from '@/api/queryKeys'

/** Adds the user to a project from the user detail (`POST /projects/:projectId/members`). Refetches the users (the open detail is under that prefix), the admin projects and the project's members. */
export const useAddUserProjectMutation = (userId: string) => {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async ({ projectId, role }: { projectId: string; role: PROJECT_ROLE }) =>
			(await http.post<ProjectMember>(`/projects/${projectId}/members`, { userId, role })).data,
		onSuccess: (_member, { projectId }) =>
			Promise.all([
				queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ADMIN.USERS() }),
				queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ADMIN.PROJECTS() }),
				queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PROJECTS.MEMBERS(projectId) }),
				invalidateDashboard(queryClient, projectId),
			]),
		onError: (error) => {
			const code = getApiErrorCode(error)
			// Added by someone else meanwhile: the table must show the project. Deleted meanwhile: the select must drop it.
			if (code === ERROR_CODE.ALREADY_MEMBER || code === ERROR_CODE.NOT_FOUND) {
				void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ADMIN.USER(userId) })
				void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ADMIN.PROJECTS() })
			}
		},
	})
}
