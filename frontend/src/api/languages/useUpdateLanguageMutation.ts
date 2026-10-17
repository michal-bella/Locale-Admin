import { useMutation, useQueryClient } from '@tanstack/react-query'

import { ERROR_CODE, type Language, type UpdateLanguageRequest } from '@locale/shared'

import getApiErrorCode from '@/api/getApiErrorCode'
import http from '@/api/http'
import { QUERY_KEYS } from '@/api/queryKeys'

type UpdateLanguageVariables = { id: string; body: UpdateLanguageRequest }

export const useUpdateLanguageMutation = () => {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async ({ id, body }: UpdateLanguageVariables) => (await http.patch<Language>(`/admin/languages/${id}`, body)).data,
		// The whole list is refetched because changing the base language changes two rows.
		onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.LANGUAGES() }),
		onError: (error) => {
			if (getApiErrorCode(error) === ERROR_CODE.NOT_FOUND) {
				void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.LANGUAGES() })
			}
		},
	})
}
