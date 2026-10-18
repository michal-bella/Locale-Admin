import { useMutation, useQueryClient } from '@tanstack/react-query'

import { type CreateLanguageRequest, ERROR_CODE, type Language } from '@locale/shared'

import getApiErrorCode from '@/api/getApiErrorCode'
import http from '@/api/http'
import { QUERY_KEYS } from '@/api/queryKeys'

export const useCreateProjectLanguageMutation = (projectId: string) => {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (body: CreateLanguageRequest) => (await http.post<Language>(`/projects/${projectId}/languages`, body)).data,
		// The first language becomes the base, which the settings show too.
		onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PROJECTS.DETAIL(projectId) }),
		// Another member added the language meanwhile; the refetch disables it in the select.
		onError: (error) => {
			if (getApiErrorCode(error) === ERROR_CODE.LANGUAGE_TAKEN) {
				void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PROJECTS.LANGUAGES(projectId) })
			}
		},
	})
}
