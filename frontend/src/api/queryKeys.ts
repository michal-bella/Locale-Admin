import {
	type ActivityDailyQueryInput,
	type ActivityListQueryInput,
	type DashboardQuery,
	type ExportCheckQuery,
	type TranslationsQueryInput,
} from '@locale/shared'

export const QUERY_KEYS = {
	HEALTH: () => ['health'] as const,
	AUTH: {
		ME: () => ['auth', 'me'] as const,
		PROVIDERS: () => ['auth', 'providers'] as const,
	},
	ADMIN: {
		USERS: () => ['admin', 'users'] as const,
		/** Under the `USERS()` prefix, so refetching the list also refetches an open user detail. */
		USER: (userId: string) => ['admin', 'users', userId] as const,
		PROJECTS: () => ['admin', 'projects'] as const,
	},
	PROFILE: () => ['profile'] as const,
	PROJECTS: {
		/** Prefix of every project query (list, members, translations, …). */
		ALL: () => ['projects'] as const,
		LIST: () => ['projects', 'list'] as const,
		/** Prefix of every query of one project, e.g. to drop them after leaving it. */
		DETAIL: (projectId: string) => ['projects', projectId] as const,
		SETTINGS: (projectId: string) => ['projects', projectId, 'settings'] as const,
		MEMBERS: (projectId: string) => ['projects', projectId, 'members'] as const,
		LANGUAGES: (projectId: string) => ['projects', projectId, 'languages'] as const,
		VERSIONS: (projectId: string) => ['projects', projectId, 'versions'] as const,
		/** Prefix of the diff summaries of every version of the project, under `VERSIONS()` so a version change refetches them too. */
		VERSION_DIFFS: (projectId: string) => ['projects', projectId, 'versions', 'diff'] as const,
		VERSION_DIFF: (projectId: string, versionId: string) => ['projects', projectId, 'versions', 'diff', versionId] as const,
		/** Prefix of every translations page of one project, e.g. to refetch them all after an edit. */
		TRANSLATIONS_ALL: (projectId: string) => ['projects', projectId, 'translations'] as const,
		TRANSLATIONS: (projectId: string, query: TranslationsQueryInput) => ['projects', projectId, 'translations', query] as const,
		EXPORT_CHECK: (projectId: string, query: Pick<ExportCheckQuery, 'languageIds' | 'status' | 'versionId' | 'diffOnly'>) =>
			['projects', projectId, 'export-check', query] as const,
		/** Prefix of the dashboard of one project for every version. */
		DASHBOARD_ALL: (projectId: string) => ['projects', projectId, 'dashboard'] as const,
		DASHBOARD: (projectId: string, query: DashboardQuery) => ['projects', projectId, 'dashboard', query] as const,
		/** Prefix of the activity feed, the history and the daily activity of one project. */
		ACTIVITY_ALL: (projectId: string) => ['projects', projectId, 'activity'] as const,
		ACTIVITY_LIST: (projectId: string, query: ActivityListQueryInput) => ['projects', projectId, 'activity', 'list', query] as const,
		ACTIVITY_DAILY: (projectId: string, query: ActivityDailyQueryInput) => ['projects', projectId, 'activity', 'daily', query] as const,
	},
} as const
