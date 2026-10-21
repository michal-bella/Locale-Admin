import { useMutation, useQueryClient } from '@tanstack/react-query'

import { type CreateTranslationKeyRequestInput, type CreateTranslationKeyResponse } from '@locale/shared'

import { invalidateDashboard } from '@/api/dashboard/invalidateDashboard'
import http from '@/api/http'
import { QUERY_KEYS } from '@/api/queryKeys'

/** `POST /projects/:id/keys` (global ADMIN). Refetches every translations page of the project before the caller closes the modal. */
export const useCreateTranslationKeyMutation = (projectId: string) => {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (body: CreateTranslationKeyRequestInput) => (await http.post<CreateTranslationKeyResponse>(`/projects/${projectId}/keys`, body)).data,
		onSuccess: () =>
			Promise.all([
				queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PROJECTS.TRANSLATIONS_ALL(projectId) }),
				invalidateDashboard(queryClient, projectId),
			]),
	})
}
