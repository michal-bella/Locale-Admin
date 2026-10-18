import { type TranslationsQueryInput } from '@locale/shared'

export const QUERY_KEYS = {
	HEALTH: () => ['health'] as const,
	AUTH: {
		ME: () => ['auth', 'me'] as const,
	},
	ADMIN: {
		USERS: () => ['admin', 'users'] as const,
	},
	PROFILE: () => ['profile'] as const,
	PROJECTS: {
		LIST: () => ['projects', 'list'] as const,
		/** Prefix of every query of one project, e.g. to drop them after leaving it. */
		DETAIL: (projectId: string) => ['projects', projectId] as const,
		SETTINGS: (projectId: string) => ['projects', projectId, 'settings'] as const,
		MEMBERS: (projectId: string) => ['projects', projectId, 'members'] as const,
		LANGUAGES: (projectId: string) => ['projects', projectId, 'languages'] as const,
		TRANSLATIONS: (projectId: string, query: TranslationsQueryInput) => ['projects', projectId, 'translations', query] as const,
	},
} as const
