import { createLazyRoute } from '@tanstack/react-router'

import ProjectSettingsPage from '@/pages/ProjectSettingsPage/ProjectSettingsPage'

export const Route = createLazyRoute('/_authenticated/_app/projects/$projectId/settings')({
	component: ProjectSettingsPage,
})
