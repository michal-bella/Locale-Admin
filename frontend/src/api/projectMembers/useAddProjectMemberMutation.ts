import { useMutation, useQueryClient } from '@tanstack/react-query'

import { type AddProjectMemberRequest, ERROR_CODE, type ProjectMember } from '@locale/shared'

import getApiErrorCode from '@/api/getApiErrorCode'
import http from '@/api/http'
import { QUERY_KEYS } from '@/api/queryKeys'

/** Adds an existing user to the project (ADMIN only). The user's `projectCount` and the project's `memberCount` change, so the admin lists are refetched too. */
export const useAddProjectMemberMutation = (projectId: string) => {
	const queryClient = useQueryClient()
	const invalidateMembers = () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PROJECTS.MEMBERS(projectId) })

	return useMutation({
		mutationFn: async (body: AddProjectMemberRequest) => (await http.post<ProjectMember>(`/projects/${projectId}/members`, body)).data,
		onSuccess: () =>
			Promise.all([
				invalidateMembers(),
				queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ADMIN.USERS() }),
				queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ADMIN.PROJECTS() }),
			]),
		onError: (error) => {
			const code = getApiErrorCode(error)
			// Added by someone else in the meantime: the list must show the row.
			if (code === ERROR_CODE.ALREADY_MEMBER) {
				void invalidateMembers()
			}
			// Deleted by another admin in the meantime: the select must drop the user.
			if (code === ERROR_CODE.NOT_FOUND) {
				void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ADMIN.USERS() })
			}
		},
	})
}
