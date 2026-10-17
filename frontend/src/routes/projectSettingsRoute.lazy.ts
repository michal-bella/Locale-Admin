import { createLazyRoute } from '@tanstack/react-router'

import ProjectSettingsPage from '@/pages/ProjectSettingsPage/ProjectSettingsPage'

export const Route = createLazyRoute('/_authenticated/project-settings')({
	component: ProjectSettingsPage,
})
