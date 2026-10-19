import { useMutation } from '@tanstack/react-query'

import { type ImportPreviewRequest, type ImportPreviewResponse } from '@locale/shared'

import http from '@/api/http'

/** Analyses the file against the project without writing anything; the FE keeps the file and sends it again on import. */
export const useImportPreviewMutation = (projectId: string) =>
	useMutation({
		mutationFn: async (body: ImportPreviewRequest) => (await http.post<ImportPreviewResponse>(`/projects/${projectId}/imports/preview`, body)).data,
	})
