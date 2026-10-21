import { queryOptions, useQuery } from '@tanstack/react-query'

import { type ExportCheckQuery, type ExportCheckResponse } from '@locale/shared'

import http from '@/api/http'
import { QUERY_KEYS } from '@/api/queryKeys'

/** Placeholder mismatches the planned export would carry (`GET /projects/:id/export/check`); informational, the export runs anyway. */
export const exportCheckQueryOptions = (projectId: string, query: Pick<ExportCheckQuery, 'languageIds' | 'status'>) =>
	queryOptions({
		queryKey: QUERY_KEYS.PROJECTS.EXPORT_CHECK(projectId, query),
		queryFn: async () =>
			(
				await http.get<ExportCheckResponse>(`/projects/${projectId}/export/check`, {
					params: { languageIds: query.languageIds.join(','), status: query.status },
				})
			).data,
	})

export const useExportCheckQuery = (projectId: string, query: Pick<ExportCheckQuery, 'languageIds' | 'status'>, enabled: boolean) =>
	useQuery({ ...exportCheckQueryOptions(projectId, query), enabled })
