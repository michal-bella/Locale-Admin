import { type QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext } from '@tanstack/react-router'

import NotFoundPage from '@/pages/NotFoundPage/NotFoundPage'

export type RouterContext = {
	queryClient: QueryClient
}

export const rootRoute = createRootRouteWithContext<RouterContext>()({
	notFoundComponent: NotFoundPage,
})
