import { useMutation, useQueryClient } from '@tanstack/react-query'

import { type CreateLanguageRequest, ERROR_CODE, type Language } from '@locale/shared'

import getApiErrorCode from '@/api/getApiErrorCode'
import http from '@/api/http'
import { QUERY_KEYS } from '@/api/queryKeys'

export const useCreateLanguageMutation = () => {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (body: CreateLanguageRequest) => (await http.post<Language>('/admin/languages', body)).data,
		onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.LANGUAGES() }),
		// Another admin added the language meanwhile; the refetch disables it in the select.
		onError: (error) => {
			if (getApiErrorCode(error) === ERROR_CODE.LANGUAGE_TAKEN) {
				void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.LANGUAGES() })
			}
		},
	})
}
