import { queryOptions, useQuery } from '@tanstack/react-query'

import { type ProjectMemberListResponse } from '@locale/shared'

import http from '@/api/http'
import { QUERY_KEYS } from '@/api/queryKeys'

export const projectMembersQueryOptions = (projectId: string) =>
	queryOptions({
		queryKey: QUERY_KEYS.PROJECTS.MEMBERS(projectId),
		queryFn: async () => (await http.get<ProjectMemberListResponse>(`/projects/${projectId}/members`)).data,
	})

export const useProjectMembersQuery = (projectId: string) => useQuery(projectMembersQueryOptions(projectId))
