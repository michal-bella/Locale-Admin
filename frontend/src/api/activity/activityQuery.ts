import { infiniteQueryOptions, keepPreviousData, queryOptions, useInfiniteQuery, useQuery } from '@tanstack/react-query'

import { type ActivityDailyQueryInput, type ActivityDailyResponse, type ActivityListResponse } from '@locale/shared'

import http from '@/api/http'
import { QUERY_KEYS } from '@/api/queryKeys'

export const ACTIVITY_FEED_PAGE_SIZE = 10

export const activityFeedQueryOptions = (projectId: string) =>
	infiniteQueryOptions({
		queryKey: QUERY_KEYS.PROJECTS.ACTIVITY_FEED(projectId),
		queryFn: async ({ pageParam }) =>
			(await http.get<ActivityListResponse>(`/projects/${projectId}/activity`, { params: { cursor: pageParam, limit: ACTIVITY_FEED_PAGE_SIZE } })).data,
		initialPageParam: undefined as string | undefined,
		getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
	})

/** The activity feed of the project, newest first, `ACTIVITY_FEED_PAGE_SIZE` events per page. */
export const useActivityInfiniteQuery = (projectId: string) => useInfiniteQuery(activityFeedQueryOptions(projectId))

export const activityDailyQueryOptions = (projectId: string, query: ActivityDailyQueryInput) =>
	queryOptions({
		queryKey: QUERY_KEYS.PROJECTS.ACTIVITY_DAILY(projectId, query),
		queryFn: async () => (await http.get<ActivityDailyResponse>(`/projects/${projectId}/activity/daily`, { params: query })).data,
	})

/** Changes per day in the user's time zone; the previous range stays on screen while another one loads. */
export const useActivityDailyQuery = (projectId: string, query: ActivityDailyQueryInput) =>
	useQuery({ ...activityDailyQueryOptions(projectId, query), placeholderData: keepPreviousData })
