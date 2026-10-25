import { type AxiosAdapter, AxiosError, type InternalAxiosRequestConfig } from 'axios'

import {
	type AuthUser,
	PROJECT_ROLE,
	type ProjectAccessRole,
	type ProjectListItem,
	type ProjectVersion,
	ROLE,
	toVersionDate,
	VERSION_LOCK,
	type VersionDiffSummary,
} from '@locale/shared'

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
	role: ROLE.USER,
	firstName: null,
	lastName: null,
	preferences: { translationsView: 'EXTENDED', translationsLayout: 'COLUMNS' },
}

export const MANAGER_USER: AuthUser = {
	id: '00000000-0000-4000-8000-000000000004',
	email: 'eva.spravca@firma.sk',
	role: ROLE.USER,
	firstName: 'Eva',
	lastName: 'Správcová',
	preferences: { translationsView: 'EXTENDED', translationsLayout: 'COLUMNS' },
}

export const VISITOR_USER: AuthUser = {
	id: '00000000-0000-4000-8000-000000000003',
	email: 'peter.hostak@firma.sk',
	role: ROLE.USER,
	firstName: 'Peter',
	lastName: 'Hosťák',
	preferences: { translationsView: 'EXTENDED', translationsLayout: 'COLUMNS' },
}

/** Role of each fixture user in every listed project (`myRole`), unless the project sets its own; the name of the fixture says it. */
const FIXTURE_PROJECT_ROLES: Record<string, ProjectAccessRole> = {
	[ADMIN_USER.id]: ROLE.ADMIN,
	[EDITOR_USER.id]: PROJECT_ROLE.EDITOR,
	[MANAGER_USER.id]: PROJECT_ROLE.MANAGER,
	[VISITOR_USER.id]: PROJECT_ROLE.VISITOR,
}

let signedInUser: AuthUser | undefined

export const apiError = (status: number, code: string, extra: { details?: unknown; headers?: Record<string, string> } = {}): MockResponse => ({
	status,
	data: { error: { code, message: 'English message that must not be shown', details: extra.details } },
	headers: extra.headers,
})

/** Replaces the HTTP layer of the shared axios instance. Unknown routes answer 404. Returns the list of sent requests. */
type ListedProject = Pick<ProjectListItem, 'id' | 'name' | 'slug' | 'primaryColor'> &
	Partial<Pick<ProjectListItem, 'isMember' | 'myRole' | 'languageTags' | 'keyCount' | 'translatedCount' | 'memberCount' | 'createdAt'>>

export const projectListResponse = (...projects: ListedProject[]): MockResponse => ({
	status: 200,
	data: {
		projects: projects.map(
			({
				isMember = true,
				myRole = (signedInUser && FIXTURE_PROJECT_ROLES[signedInUser.id]) ?? PROJECT_ROLE.EDITOR,
				languageTags = [],
				keyCount = 0,
				translatedCount = 0,
				memberCount = 1,
				createdAt = '2026-10-12T08:00:00.000Z',
				...project
			}): ProjectListItem => ({
				...project,
				isMember,
				myRole,
				languageTags,
				keyCount,
				translatedCount,
				memberCount,
				createdAt,
			}),
		),
	},
})

/** `GET /projects` with these projects; project routes resolve the slug in the URL through it. Built per request, so `myRole` follows `signedInAs`. */
export const projectListRoute = (...projects: ListedProject[]): MockRoutes => ({ 'GET /projects': () => projectListResponse(...projects) })

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

export const signedInAs = (user: AuthUser, routes: MockRoutes = {}) => {
	signedInUser = user
	return mockApi({ 'GET /auth/me': { status: 200, data: user }, ...routes })
}

export const signedOut = (routes: MockRoutes = {}) => {
	signedInUser = undefined
	return mockApi({ 'GET /auth/me': apiError(401, 'AUTH_UNAUTHENTICATED'), ...routes })
}

export const resetApiMock = () => {
	signedInUser = undefined
	http.defaults.adapter = originalAdapter
}

const dayShift = (days: number) => toVersionDate(new Date(Date.now() + days * 86_400_000))

/** A version of a project; the defaults are an active window around today, so a list request with it has `versionId`. */
export const projectVersion = (overrides: Partial<ProjectVersion> & Pick<ProjectVersion, 'id' | 'name'>): ProjectVersion => ({
	startsAt: dayShift(-5),
	endsAt: dayShift(12),
	lock: VERSION_LOCK.AUTO,
	isLocked: false,
	state: 'ACTIVE',
	isCurrent: false,
	importedAt: '2026-10-01T10:00:00.000Z',
	keyCount: 4,
	createdAt: '2026-09-01T10:00:00.000Z',
	createdBy: null,
	...overrides,
})

/** The current version of a project; every translations page needs one, since the list always shows a version. */
export const CURRENT_VERSION = projectVersion({ id: '00000000-0000-4000-8000-000000000502', name: 'v2.45', isCurrent: true })

/** Body of `GET /projects/:id/versions/:versionId/diff`; the default is the first version of a project (no previous one, nothing counted). */
export const versionDiff = (overrides: Partial<VersionDiffSummary> = {}): VersionDiffSummary => ({
	previousVersion: null,
	added: 0,
	changed: 0,
	removed: 0,
	...overrides,
})
