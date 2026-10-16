import { QueryClient } from '@tanstack/react-query'

import { isUnauthorizedError } from '@/api/isUnauthorizedError'

const MAX_RETRIES = 3

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			retry: (failureCount, error) => !isUnauthorizedError(error) && failureCount < MAX_RETRIES,
		},
	},
})

export default queryClient
