import { createRoute } from '@tanstack/react-router'

import { rootRoute } from '@/routes/rootRoute'

// Public: the guide is a static PDF, anyone with the link can read it.
export const onboardingRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/onboarding',
}).lazy(() => import('@/routes/onboardingRoute.lazy').then((module) => module.Route))
