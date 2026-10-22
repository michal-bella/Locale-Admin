import { useMutation } from '@tanstack/react-query'
import { isAxiosError } from 'axios'

import { type ExportQuery } from '@locale/shared'

import http from '@/api/http'

/** Downloads the CSV or XLSX as a Blob. An error body is a Blob too, so it is parsed back to JSON for `getApiErrorCode`. */
export const useExportMutation = (projectId: string) =>
	useMutation({
		mutationFn: async ({
			languageIds,
			status,
			format,
			versionId,
			versionScope,
		}: Omit<ExportQuery, 'versionScope'> & Partial<Pick<ExportQuery, 'versionScope'>>) => {
			try {
				return (
					await http.get<Blob>(`/projects/${projectId}/export`, {
						params: { languageIds: languageIds.join(','), status, format, versionId, versionScope },
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
