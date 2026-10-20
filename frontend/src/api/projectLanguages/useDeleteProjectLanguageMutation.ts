import { useMutation, useQueryClient } from '@tanstack/react-query'

import { ERROR_CODE } from '@locale/shared'

import { invalidateDashboard } from '@/api/dashboard/invalidateDashboard'
import getApiErrorCode from '@/api/getApiErrorCode'
import http from '@/api/http'
import { QUERY_KEYS } from '@/api/queryKeys'

export const useDeleteProjectLanguageMutation = (projectId: string) => {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (id: string) => {
			await http.delete(`/projects/${projectId}/languages/${id}`)
		},
		onSuccess: () =>
			Promise.all([queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PROJECTS.LANGUAGES(projectId) }), invalidateDashboard(queryClient, projectId)]),
		onError: (error) => {
			const code = getApiErrorCode(error)
			// LANGUAGE_IS_BASE: another member may have made it the base language meanwhile.
			if (code === ERROR_CODE.NOT_FOUND || code === ERROR_CODE.LANGUAGE_IS_BASE) {
				void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PROJECTS.LANGUAGES(projectId) })
			}
		},
	})
}
