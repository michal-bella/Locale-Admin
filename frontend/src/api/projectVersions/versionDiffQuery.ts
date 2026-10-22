import { queryOptions, useQuery } from '@tanstack/react-query'

import { type VersionDiffSummary } from '@locale/shared'

import http from '@/api/http'
import { QUERY_KEYS } from '@/api/queryKeys'

export const versionDiffQueryOptions = (projectId: string, versionId: string) =>
	queryOptions({
		queryKey: QUERY_KEYS.PROJECTS.VERSION_DIFF(projectId, versionId),
		queryFn: async () => (await http.get<VersionDiffSummary>(`/projects/${projectId}/versions/${versionId}/diff`)).data,
	})

/** How the version differs from the nearest older one (`GET /projects/:id/versions/:versionId/diff`); `null` (a version without import) asks nothing. */
export const useVersionDiffQuery = (projectId: string, versionId: string | null) =>
	useQuery({ ...versionDiffQueryOptions(projectId, versionId ?? ''), enabled: versionId !== null })
