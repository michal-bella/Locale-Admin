import { createRoute } from '@tanstack/react-router'

import i18n from '@/lib/i18n'
import { onboardingGuidePath } from '@/lib/onboardingGuide'
import { rootRoute } from '@/routes/rootRoute'

// Public: the guide is a static PDF, so the route only sends the browser to the one in the stored UI language.
export const onboardingRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/onboarding',
	beforeLoad: () => {
		window.location.replace(onboardingGuidePath(i18n.language))
	},
	component: () => null,
})
