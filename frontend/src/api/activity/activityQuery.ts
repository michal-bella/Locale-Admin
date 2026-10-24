import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query'

import { type ActivityDailyQueryInput, type ActivityDailyResponse, type ActivityListQueryInput, type ActivityListResponse } from '@locale/shared'

import http from '@/api/http'
import { QUERY_KEYS } from '@/api/queryKeys'

export const activityListQueryOptions = (projectId: string, query: ActivityListQueryInput) =>
	queryOptions({
		queryKey: QUERY_KEYS.PROJECTS.ACTIVITY_LIST(projectId, query),
		queryFn: async () => (await http.get<ActivityListResponse>(`/projects/${projectId}/activity`, { params: query })).data,
	})

/** One page of the project's events, newest first; the previous page stays on screen while another page or filter loads. */
export const useActivityListQuery = (projectId: string, query: ActivityListQueryInput) =>
	useQuery({ ...activityListQueryOptions(projectId, query), placeholderData: keepPreviousData })

export const activityDailyQueryOptions = (projectId: string, query: ActivityDailyQueryInput) =>
	queryOptions({
		queryKey: QUERY_KEYS.PROJECTS.ACTIVITY_DAILY(projectId, query),
		queryFn: async () => (await http.get<ActivityDailyResponse>(`/projects/${projectId}/activity/daily`, { params: query })).data,
	})

/** Changes per day in the user's time zone; the previous range stays on screen while another one loads. */
export const useActivityDailyQuery = (projectId: string, query: ActivityDailyQueryInput) =>
	useQuery({ ...activityDailyQueryOptions(projectId, query), placeholderData: keepPreviousData })
