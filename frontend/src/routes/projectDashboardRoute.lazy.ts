import { createLazyRoute } from '@tanstack/react-router'

import DashboardPage from '@/pages/DashboardPage/DashboardPage'

export const Route = createLazyRoute('/_authenticated/_app/projects/$projectSlug/dashboard')({
	component: DashboardPage,
})
