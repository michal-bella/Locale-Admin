import { useMutation, useQueryClient } from '@tanstack/react-query'

import { type ProjectListResponse } from '@locale/shared'

import http from '@/api/http'
import { QUERY_KEYS } from '@/api/queryKeys'

/** `PUT /projects/order` with the ids in the new order. Reorders the cached list right away, restores it on error and refetches on settle. */
export const useReorderProjectsMutation = () => {
	const queryClient = useQueryClient()
	const listKey = QUERY_KEYS.PROJECTS.LIST()

	return useMutation({
		mutationFn: async (projectIds: string[]) => {
			await http.put('/projects/order', { projectIds })
		},
		onMutate: async (projectIds) => {
			await queryClient.cancelQueries({ queryKey: listKey })
			const previous = queryClient.getQueryData<ProjectListResponse>(listKey)
			queryClient.setQueryData<ProjectListResponse>(listKey, (current) => {
				if (!current) {
					return current
				}
				const position = new Map(projectIds.map((id, index) => [id, index]))
				return { projects: [...current.projects].sort((a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0)) }
			})
			return { previous }
		},
		onError: (_error, _projectIds, context) => {
			if (context?.previous) {
				queryClient.setQueryData(listKey, context.previous)
			}
		},
		onSettled: () => queryClient.invalidateQueries({ queryKey: listKey }),
	})
}
