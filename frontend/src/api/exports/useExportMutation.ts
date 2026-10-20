import { useMutation } from '@tanstack/react-query'
import { isAxiosError } from 'axios'

import { type ExportStatus } from '@locale/shared'

import http from '@/api/http'

type ExportVariables = { languageIds: string[]; status: ExportStatus }

/** Downloads the CSV as a Blob. An error body is a Blob too, so it is parsed back to JSON for `getApiErrorCode`. */
export const useExportMutation = (projectId: string) =>
	useMutation({
		mutationFn: async ({ languageIds, status }: ExportVariables) => {
			try {
				return (
					await http.get<Blob>(`/projects/${projectId}/export`, {
						params: { languageIds: languageIds.join(','), status },
						responseType: 'blob',
					})
				).data
			} catch (error) {
				if (isAxiosError(error) && error.response?.data instanceof Blob) {
					const text = await error.response.data.text()
					try {
						error.response.data = JSON.parse(text) as unknown
					} catch {
						error.response.data = text
					}
				}
				throw error
			}
		},
	})
