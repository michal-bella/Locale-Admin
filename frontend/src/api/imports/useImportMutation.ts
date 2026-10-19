import { useMutation, useQueryClient } from '@tanstack/react-query'

import { type ImportRequestInput, type ImportResult } from '@locale/shared'

import http from '@/api/http'
import { QUERY_KEYS } from '@/api/queryKeys'

export const useImportMutation = (projectId: string) => {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (body: ImportRequestInput) => (await http.post<ImportResult>(`/projects/${projectId}/imports`, body)).data,
		// The import changes translations and their stats on every page of the list; the project prefix covers them and the languages.
		onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PROJECTS.DETAIL(projectId) }),
	})
}
