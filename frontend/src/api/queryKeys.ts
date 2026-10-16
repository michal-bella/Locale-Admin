export const QUERY_KEYS = {
	HEALTH: () => ['health'] as const,
	AUTH: {
		ME: () => ['auth', 'me'] as const,
	},
} as const
