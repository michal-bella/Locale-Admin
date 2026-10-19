import { useMutation, useQueryClient } from '@tanstack/react-query'

import { type UpdateTranslationKeyRequestInput, type UpdateTranslationKeyResponse } from '@locale/shared'

import http from '@/api/http'
import { QUERY_KEYS } from '@/api/queryKeys'

export type UpdateTranslationKeyVariables = { keyId: string; body: UpdateTranslationKeyRequestInput }

/** `PATCH /projects/:id/keys/:keyId` (global ADMIN). Refetches every translations page of the project before the caller closes the modal. */
export const useUpdateTranslationKeyMutation = (projectId: string) => {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async ({ keyId, body }: UpdateTranslationKeyVariables) =>
			(await http.patch<UpdateTranslationKeyResponse>(`/projects/${projectId}/keys/${keyId}`, body)).data,
		onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PROJECTS.TRANSLATIONS_ALL(projectId) }),
	})
}
