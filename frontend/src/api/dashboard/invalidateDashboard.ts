import { type QueryClient } from '@tanstack/react-query'

import { QUERY_KEYS } from '@/api/queryKeys'

/** Refetches the Prehľad numbers and the activity of a project after a mutation that writes an activity event. */
export const invalidateDashboard = (queryClient: QueryClient, projectId: string) =>
	Promise.all([
		queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PROJECTS.DASHBOARD_ALL(projectId) }),
		queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PROJECTS.ACTIVITY_ALL(projectId) }),
	])
