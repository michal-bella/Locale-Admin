export const QUERY_KEYS = {
	HEALTH: () => ['health'] as const,
	AUTH: {
		ME: () => ['auth', 'me'] as const,
	},
	ADMIN: {
		USERS: () => ['admin', 'users'] as const,
	},
	PROFILE: () => ['profile'] as const,
	LANGUAGES: () => ['languages'] as const,
	PROJECTS: {
		LIST: () => ['projects', 'list'] as const,
		/** Prefix of every query of one project, e.g. to drop them after leaving it. */
		DETAIL: (projectId: string) => ['projects', projectId] as const,
		SETTINGS: (projectId: string) => ['projects', projectId, 'settings'] as const,
		MEMBERS: (projectId: string) => ['projects', projectId, 'members'] as const,
	},
} as const
