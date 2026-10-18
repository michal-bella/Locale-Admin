import { createLazyRoute } from '@tanstack/react-router'

import ProjectLanguagesPage from '@/pages/ProjectLanguagesPage/ProjectLanguagesPage'

export const Route = createLazyRoute('/_authenticated/_app/projects/$projectSlug/languages')({
	component: ProjectLanguagesPage,
})
