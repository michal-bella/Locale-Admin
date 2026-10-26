import { createLazyRoute } from '@tanstack/react-router'

import OnboardingPage from '@/pages/OnboardingPage/OnboardingPage'

export const Route = createLazyRoute('/onboarding')({
	component: OnboardingPage,
})
