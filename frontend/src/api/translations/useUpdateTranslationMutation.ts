import { useMutation, useQueryClient } from '@tanstack/react-query'

import { type TranslationListItem, type TranslationsQueryInput, type TranslationsResponse, type UpdateTranslationResponse } from '@locale/shared'

import http from '@/api/http'
import { QUERY_KEYS } from '@/api/queryKeys'

export type UpdateTranslationVariables = { keyId: string; languageId: string; value: string | null }

/** Row status as the API computes it: the target language decides in the compact view, every language in the extended view. */
const rowStatus = (item: TranslationListItem, targetLanguageId: string | undefined): TranslationListItem['status'] => {
	const cells = targetLanguageId === undefined ? Object.values(item.translations) : [item.translations[targetLanguageId]]
	return cells.every((cell) => cell?.status === 'TRANSLATED') ? 'TRANSLATED' : 'UNTRANSLATED'
}

const applyUpdate = (data: TranslationsResponse, { keyId, languageId, value }: UpdateTranslationVariables, targetLanguageId: string | undefined) => {
	const item = data.items.find((candidate) => candidate.keyId === keyId)
	if (!item) {
		return data
	}
	const cell = { value, status: value === null ? 'UNTRANSLATED' : 'TRANSLATED', updatedAt: new Date().toISOString() } as const
	const updated: TranslationListItem = { ...item, translations: { ...item.translations, [languageId]: cell } }
	updated.status = rowStatus(updated, targetLanguageId)
	const delta = updated.status === item.status ? 0 : updated.status === 'TRANSLATED' ? 1 : -1
	return {
		...data,
		items: data.items.map((candidate) => (candidate.keyId === keyId ? updated : candidate)),
		stats: { ...data.stats, translated: data.stats.translated + delta, untranslated: data.stats.untranslated - delta },
	}
}

/**
 * `PUT /projects/:id/keys/:keyId/translations/:languageId`. Updates the page `listQuery` in the cache optimistically (the cell, the row
 * status and `stats` when it flips), restores the snapshot on error and refetches every translations page of the project on settle,
 * which also repairs a rollback that undid a concurrent edit of another row.
 */
export const useUpdateTranslationMutation = (projectId: string, listQuery: TranslationsQueryInput | null) => {
	const queryClient = useQueryClient()
	const listKey = listQuery && QUERY_KEYS.PROJECTS.TRANSLATIONS(projectId, listQuery)
	// The query input type is `unknown` for preprocessed fields; the page always passes a string or nothing.
	const targetLanguageId = typeof listQuery?.targetLanguageId === 'string' ? listQuery.targetLanguageId : undefined

	return useMutation({
		mutationFn: async ({ keyId, languageId, value }: UpdateTranslationVariables) =>
			(await http.put<UpdateTranslationResponse>(`/projects/${projectId}/keys/${keyId}/translations/${languageId}`, { value })).data,
		onMutate: async (variables) => {
			if (!listKey) {
				return { previous: undefined }
			}
			await queryClient.cancelQueries({ queryKey: listKey })
			const previous = queryClient.getQueryData<TranslationsResponse>(listKey)
			queryClient.setQueryData<TranslationsResponse>(listKey, (current) => current && applyUpdate(current, variables, targetLanguageId))
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
