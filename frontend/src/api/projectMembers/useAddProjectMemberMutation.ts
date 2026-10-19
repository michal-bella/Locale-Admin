import { useMutation, useQueryClient } from '@tanstack/react-query'

import { type AddProjectMemberRequest, ERROR_CODE, type ProjectMember } from '@locale/shared'

import getApiErrorCode from '@/api/getApiErrorCode'
import http from '@/api/http'
import { QUERY_KEYS } from '@/api/queryKeys'

/** Adds an existing user to the project (ADMIN only). The user's `projectCount` changes, so the admin list is refetched too. */
export const useAddProjectMemberMutation = (projectId: string) => {
	const queryClient = useQueryClient()
	const invalidateMembers = () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PROJECTS.MEMBERS(projectId) })

	return useMutation({
		mutationFn: async (body: AddProjectMemberRequest) => (await http.post<ProjectMember>(`/projects/${projectId}/members`, body)).data,
		onSuccess: () => Promise.all([invalidateMembers(), queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ADMIN.USERS() })]),
		onError: (error) => {
			// Added by someone else in the meantime: the list must show the row.
			if (getApiErrorCode(error) === ERROR_CODE.ALREADY_MEMBER) {
				void invalidateMembers()
			}
		},
	})
}
