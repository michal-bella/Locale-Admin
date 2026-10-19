import { useMutation, useQueryClient } from '@tanstack/react-query'

import { type TranslationsQueryInput, type TranslationsResponse, type UpdateTranslationResponse } from '@locale/shared'

import http from '@/api/http'
import { QUERY_KEYS } from '@/api/queryKeys'

export type UpdateTranslationVariables = { keyId: string; languageId: string; value: string | null }

const applyUpdate = (data: TranslationsResponse, keyId: string, value: string | null): TranslationsResponse => {
	const item = data.items.find((candidate) => candidate.keyId === keyId)
	if (!item) {
		return data
	}
	const status = value === null ? 'UNTRANSLATED' : 'TRANSLATED'
	const delta = status === item.target.status ? 0 : status === 'TRANSLATED' ? 1 : -1
	return {
		...data,
		items: data.items.map((candidate) =>
			candidate.keyId === keyId ? { ...candidate, target: { value, status, updatedAt: new Date().toISOString() } } : candidate,
		),
		stats: { ...data.stats, translated: data.stats.translated + delta, untranslated: data.stats.untranslated - delta },
	}
}

/**
 * `PUT /projects/:id/keys/:keyId/translations/:languageId`. Updates the page `listQuery` in the cache optimistically (target cell and
 * `stats` when the status flips), restores the snapshot on error and refetches every translations page of the project on settle,
 * which also repairs a rollback that undid a concurrent edit of another row.
 */
export const useUpdateTranslationMutation = (projectId: string, listQuery: TranslationsQueryInput | null) => {
	const queryClient = useQueryClient()
	const listKey = listQuery && QUERY_KEYS.PROJECTS.TRANSLATIONS(projectId, listQuery)

	return useMutation({
		mutationFn: async ({ keyId, languageId, value }: UpdateTranslationVariables) =>
			(await http.put<UpdateTranslationResponse>(`/projects/${projectId}/keys/${keyId}/translations/${languageId}`, { value })).data,
		onMutate: async ({ keyId, value }) => {
			if (!listKey) {
				return { previous: undefined }
			}
			await queryClient.cancelQueries({ queryKey: listKey })
			const previous = queryClient.getQueryData<TranslationsResponse>(listKey)
			queryClient.setQueryData<TranslationsResponse>(listKey, (current) => current && applyUpdate(current, keyId, value))
			return { previous }
		},
		onError: (_error, _variables, context) => {
			if (listKey && context?.previous) {
				queryClient.setQueryData(listKey, context.previous)
			}
		},
		onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PROJECTS.TRANSLATIONS_ALL(projectId) }),
	})
}
