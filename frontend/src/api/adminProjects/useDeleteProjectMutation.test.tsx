import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { type ReactNode } from 'react'
import { describe, expect, it } from 'vite-plus/test'

import { useDeleteProjectMutation } from '@/api/adminProjects/useDeleteProjectMutation'
import { useProjectsQuery } from '@/api/projects/projectsQuery'
import queryClient from '@/api/queryClient'
import { QUERY_KEYS } from '@/api/queryKeys'
import { apiError, mockApi, projectListResponse } from '@/test/mockApi'

const PROJECT = { id: '00000000-0000-4000-8000-000000000801', name: 'B2B Admin', slug: 'b2b-admin', primaryColor: '#E83E8C' }
const OTHER_PROJECT_ID = '00000000-0000-4000-8000-000000000802'
const DELETE_ROUTE = `DELETE /admin/projects/${PROJECT.id}`

const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>

const seedCache = () => {
	queryClient.setQueryData(QUERY_KEYS.PROJECTS.SETTINGS(PROJECT.id), { id: PROJECT.id })
	queryClient.setQueryData(QUERY_KEYS.PROJECTS.LANGUAGES(PROJECT.id), [])
	queryClient.setQueryData(QUERY_KEYS.PROJECTS.SETTINGS(OTHER_PROJECT_ID), { id: OTHER_PROJECT_ID })
	queryClient.setQueryData(QUERY_KEYS.ADMIN.PROJECTS(), { projects: [] })
}

const projectListGets = (requests: { method?: string; url?: string }[]) =>
	requests.filter((request) => request.method === 'get' && request.url === '/projects').length

// The project list has an observer, so its invalidation shows up as a second GET /projects.
const renderDelete = async (deleteResponse: Parameters<typeof mockApi>[0][string]) => {
	const requests = mockApi({ 'GET /projects': projectListResponse(PROJECT), [DELETE_ROUTE]: deleteResponse })
	const { result } = renderHook(() => ({ deleteProject: useDeleteProjectMutation(), projects: useProjectsQuery() }), { wrapper })
	await waitFor(() => expect(result.current.projects.isSuccess).toBe(true))
	seedCache()
	return { result, requests }
}

describe('useDeleteProjectMutation', () => {
	it.each([
		['deleted', { status: 204 }],
		['already deleted (404)', apiError(404, 'NOT_FOUND')],
	])('drops the cached project and refreshes the lists when %s', async (_case, deleteResponse) => {
		const { result, requests } = await renderDelete(deleteResponse)

		await result.current.deleteProject.mutateAsync(PROJECT.id).catch(() => undefined)

		expect(queryClient.getQueryData(QUERY_KEYS.PROJECTS.SETTINGS(PROJECT.id))).toBeUndefined()
		expect(queryClient.getQueryData(QUERY_KEYS.PROJECTS.LANGUAGES(PROJECT.id))).toBeUndefined()
		expect(queryClient.getQueryData(QUERY_KEYS.PROJECTS.SETTINGS(OTHER_PROJECT_ID))).toEqual({ id: OTHER_PROJECT_ID })
		expect(queryClient.getQueryState(QUERY_KEYS.ADMIN.PROJECTS())?.isInvalidated).toBe(true)
		await waitFor(() => expect(projectListGets(requests)).toBe(2))
	})

	it('keeps the cache on other errors', async () => {
		const { result, requests } = await renderDelete(apiError(500, 'INTERNAL_ERROR'))

		await expect(result.current.deleteProject.mutateAsync(PROJECT.id)).rejects.toThrow()

		expect(queryClient.getQueryData(QUERY_KEYS.PROJECTS.SETTINGS(PROJECT.id))).toEqual({ id: PROJECT.id })
		expect(queryClient.getQueryData(QUERY_KEYS.PROJECTS.LANGUAGES(PROJECT.id))).toEqual([])
		expect(queryClient.getQueryState(QUERY_KEYS.ADMIN.PROJECTS())?.isInvalidated).toBe(false)
		expect(projectListGets(requests)).toBe(1)
	})
})
