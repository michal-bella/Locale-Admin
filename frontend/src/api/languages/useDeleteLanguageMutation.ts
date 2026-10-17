import { useMutation, useQueryClient } from '@tanstack/react-query'

import { ERROR_CODE } from '@locale/shared'

import getApiErrorCode from '@/api/getApiErrorCode'
import http from '@/api/http'
import { QUERY_KEYS } from '@/api/queryKeys'

export const useDeleteLanguageMutation = () => {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (id: string) => {
			await http.delete(`/admin/languages/${id}`)
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.LANGUAGES() }),
		onError: (error) => {
			if (getApiErrorCode(error) === ERROR_CODE.NOT_FOUND) {
				void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.LANGUAGES() })
			}
		},
	})
}
