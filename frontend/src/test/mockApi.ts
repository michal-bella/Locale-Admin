import { type AxiosAdapter, AxiosError, type InternalAxiosRequestConfig } from 'axios'

import { type AuthUser, type ProjectListItem, ROLE } from '@locale/shared'

import http from '@/api/http'

type MockResponse = { status: number; data?: unknown; headers?: Record<string, string> }

/** Keys are `METHOD /url` relative to `/api`, e.g. `GET /auth/me`. */
export type MockRoutes = Record<string, MockResponse | ((config: InternalAxiosRequestConfig) => MockResponse)>

const originalAdapter = http.defaults.adapter

export const ADMIN_USER: AuthUser = {
	id: '00000000-0000-4000-8000-000000000001',
	email: 'admin@firma.sk',
	role: ROLE.ADMIN,
	firstName: 'Martin',
	lastName: 'Kováč',
	preferences: { translationsView: 'EXTENDED', translationsLayout: 'COLUMNS' },
}

export const EDITOR_USER: AuthUser = {
	id: '00000000-0000-4000-8000-000000000002',
	email: 'jana.novakova@firma.sk',
	role: ROLE.EDITOR,
	firstName: null,
	lastName: null,
	preferences: { translationsView: 'EXTENDED', translationsLayout: 'COLUMNS' },
}

export const apiError = (status: number, code: string, extra: { details?: unknown; headers?: Record<string, string> } = {}): MockResponse => ({
	status,
	data: { error: { code, message: 'English message that must not be shown', details: extra.details } },
	headers: extra.headers,
})

/** Replaces the HTTP layer of the shared axios instance. Unknown routes answer 404. Returns the list of sent requests. */
type ListedProject = Pick<ProjectListItem, 'id' | 'name' | 'slug' | 'primaryColor'> &
	Partial<Pick<ProjectListItem, 'isMember' | 'languageTags' | 'keyCount' | 'translatedCount'>>

export const projectListResponse = (...projects: ListedProject[]): MockResponse => ({
	status: 200,
	data: {
		projects: projects.map(({ isMember = true, languageTags = [], keyCount = 0, translatedCount = 0, ...project }): ProjectListItem => ({
			...project,
			isMember,
			languageTags,
			keyCount,
			translatedCount,
		})),
	},
})

/** `GET /projects` with these projects; project routes resolve the slug in the URL through it. */
export const projectListRoute = (...projects: ListedProject[]): MockRoutes => ({ 'GET /projects': projectListResponse(...projects) })

export const mockApi = (routes: MockRoutes) => {
	const requests: InternalAxiosRequestConfig[] = []
	const adapter: AxiosAdapter = (config) => {
		requests.push(config)
		const route = routes[`${config.method?.toUpperCase()} ${config.url}`]
		const mock = typeof route === 'function' ? route(config) : (route ?? apiError(404, 'NOT_FOUND'))
		const response = { data: mock.data, status: mock.status, statusText: '', headers: mock.headers ?? {}, config }
		if (mock.status >= 400) {
			return Promise.reject(new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, undefined, response))
		}
		return Promise.resolve(response)
	}
	http.defaults.adapter = adapter
	return requests
}

export const signedInAs = (user: AuthUser, routes: MockRoutes = {}) => mockApi({ 'GET /auth/me': { status: 200, data: user }, ...routes })

export const signedOut = (routes: MockRoutes = {}) => mockApi({ 'GET /auth/me': apiError(401, 'AUTH_UNAUTHENTICATED'), ...routes })

export const resetApiMock = () => {
	http.defaults.adapter = originalAdapter
}
