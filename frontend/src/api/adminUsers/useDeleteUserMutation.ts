import { useMutation, useQueryClient } from '@tanstack/react-query'

import { ERROR_CODE } from '@locale/shared'

import getApiErrorCode from '@/api/getApiErrorCode'
import http from '@/api/http'
import { QUERY_KEYS } from '@/api/queryKeys'

export const useDeleteUserMutation = () => {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (id: string) => {
			await http.delete(`/admin/users/${id}`)
		},
		// The user may have been a member of an open project, so every project query is refetched too. Only the list is refetched, not the
		// deleted user's detail: on the detail page that would show „Používateľ sa nenašiel“ before the page leaves to the list.
		onSuccess: (_data, id) =>
			Promise.all([
				queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ADMIN.USERS(), exact: true }),
				queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ADMIN.USER(id), refetchType: 'none' }),
				queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ADMIN.PROJECTS() }),
				queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PROJECTS.ALL() }),
			]),
		onError: (error) => {
			// Already deleted by another admin: the list must drop the row.
			if (getApiErrorCode(error) === ERROR_CODE.NOT_FOUND) {
				void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ADMIN.USERS(), exact: true })
			}
		},
	})
}
