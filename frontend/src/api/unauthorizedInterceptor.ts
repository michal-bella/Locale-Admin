import { type QueryClient } from '@tanstack/react-query'

import http from '@/api/http'
import { isUnauthorizedError } from '@/api/isUnauthorizedError'
import { type AppRouter } from '@/routes/router'

// A wrong password on /auth/login is a form error. A 401 from /auth/me is handled by the route guards,
// which redirect on their own; reacting here as well would navigate twice.
const IGNORED_URLS = new Set(['/auth/login', '/auth/me'])

/** Sends the user to /login when the session expires during use. Returns the axios interceptor id. */
export const installUnauthorizedInterceptor = ({ router, queryClient }: { router: AppRouter; queryClient: QueryClient }) =>
	http.interceptors.response.use(undefined, (error: Error) => {
		if (isUnauthorizedError(error) && !IGNORED_URLS.has(error.config?.url ?? '')) {
			queryClient.clear()
			void router.navigate({ to: '/login' })
		}
		return Promise.reject(error)
	})
