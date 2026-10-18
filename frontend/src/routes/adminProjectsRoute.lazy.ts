import { createLazyRoute } from '@tanstack/react-router'

import AdminProjectsPage from '@/pages/AdminProjectsPage/AdminProjectsPage'

export const Route = createLazyRoute('/_authenticated/_app/admin/projects')({
	component: AdminProjectsPage,
})
