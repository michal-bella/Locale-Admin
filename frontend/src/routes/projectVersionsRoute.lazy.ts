import { createLazyRoute } from '@tanstack/react-router'

import ProjectVersionsPage from '@/pages/ProjectVersionsPage/ProjectVersionsPage'

export const Route = createLazyRoute('/_authenticated/_app/projects/$projectSlug/versions')({
	component: ProjectVersionsPage,
})
