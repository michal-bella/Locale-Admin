import { createRoute } from '@tanstack/react-router'

import ProjectsPage from '@/pages/ProjectsPage/ProjectsPage'
import { homeLayoutRoute } from '@/routes/homeLayoutRoute'

export const indexRoute = createRoute({
	getParentRoute: () => homeLayoutRoute,
	path: '/',
	component: ProjectsPage,
})
