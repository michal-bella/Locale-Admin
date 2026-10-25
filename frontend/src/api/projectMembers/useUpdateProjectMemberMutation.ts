import { useMutation, useQueryClient } from '@tanstack/react-query'

import { type PROJECT_ROLE, type ProjectMember } from '@locale/shared'

import { invalidateDashboard } from '@/api/dashboard/invalidateDashboard'
import http from '@/api/http'
import { QUERY_KEYS } from '@/api/queryKeys'

type UpdateProjectMemberVariables = { projectId: string; userId: string; role: PROJECT_ROLE }

/** `PATCH /projects/:projectId/members/:userId` (ADMIN only): the role of a member, from the members page or the user detail. */
export const useUpdateProjectMemberMutation = () => {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async ({ projectId, userId, role }: UpdateProjectMemberVariables) =>
			(await http.patch<ProjectMember>(`/projects/${projectId}/members/${userId}`, { role })).data,
		onSuccess: (_member, { projectId }) =>
			Promise.all([
				queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PROJECTS.MEMBERS(projectId) }),
				queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ADMIN.USERS() }),
				invalidateDashboard(queryClient, projectId),
			]),
	})
}
