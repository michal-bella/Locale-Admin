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
	PROJECT_SETTINGS: () => ['projectSettings'] as const,
} as const
