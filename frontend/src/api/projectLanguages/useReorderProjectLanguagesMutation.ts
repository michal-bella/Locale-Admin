import { useMutation, useQueryClient } from '@tanstack/react-query'

import { type LanguagesResponse } from '@locale/shared'

import { invalidateDashboard } from '@/api/dashboard/invalidateDashboard'
import http from '@/api/http'
import { QUERY_KEYS } from '@/api/queryKeys'

/**
 * `PUT /projects/:projectId/languages/order` with every language id in the new order; the first one becomes the base.
 * Reorders the cached list right away, restores it on error. The settings (base language) and the project list (flags) follow on settle.
 */
export const useReorderProjectLanguagesMutation = (projectId: string) => {
	const queryClient = useQueryClient()
	const listKey = QUERY_KEYS.PROJECTS.LANGUAGES(projectId)

	return useMutation({
		mutationFn: async (languageIds: string[]) => (await http.put<LanguagesResponse>(`/projects/${projectId}/languages/order`, { languageIds })).data,
		onMutate: async (languageIds) => {
			await queryClient.cancelQueries({ queryKey: listKey })
			const previous = queryClient.getQueryData<LanguagesResponse>(listKey)
			queryClient.setQueryData<LanguagesResponse>(listKey, (current) => {
				if (!current) {
					return current
				}
				const position = new Map(languageIds.map((id, index) => [id, index]))
				return [...current]
					.sort((a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0))
					.map((language) => ({ ...language, isBase: language.id === languageIds[0] }))
			})
			return { previous }
		},
		onSuccess: (languages) => queryClient.setQueryData(listKey, languages),
		onError: (_error, _languageIds, context) => {
			if (context?.previous) {
				queryClient.setQueryData(listKey, context.previous)
			}
		},
		onSettled: () =>
			Promise.all([
				queryClient.invalidateQueries({ queryKey: listKey }),
				queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PROJECTS.SETTINGS(projectId) }),
				queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PROJECTS.LIST() }),
				invalidateDashboard(queryClient, projectId),
			]),
	})
}
