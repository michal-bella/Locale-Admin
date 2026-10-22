import { queryOptions, useQuery } from '@tanstack/react-query'

import { type ExportCheckQuery, type ExportCheckResponse } from '@locale/shared'

import http from '@/api/http'
import { QUERY_KEYS } from '@/api/queryKeys'

/** Placeholder mismatches the planned export would carry (`GET /projects/:id/export/check`); informational, the export runs anyway. */
export type ExportCheckInput = Pick<ExportCheckQuery, 'languageIds' | 'status' | 'versionId'> & Partial<Pick<ExportCheckQuery, 'versionScope'>>

export const exportCheckQueryOptions = (projectId: string, query: ExportCheckInput) =>
	queryOptions({
		queryKey: QUERY_KEYS.PROJECTS.EXPORT_CHECK(projectId, query),
		queryFn: async () =>
			(
				await http.get<ExportCheckResponse>(`/projects/${projectId}/export/check`, {
					params: { languageIds: query.languageIds.join(','), status: query.status, versionId: query.versionId, versionScope: query.versionScope },
				})
			).data,
	})

export const useExportCheckQuery = (projectId: string, query: ExportCheckInput, enabled: boolean) =>
	useQuery({ ...exportCheckQueryOptions(projectId, query), enabled })
