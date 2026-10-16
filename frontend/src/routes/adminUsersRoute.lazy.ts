import { createLazyRoute } from '@tanstack/react-router'

import UsersPage from '@/pages/UsersPage/UsersPage'

export const Route = createLazyRoute('/_authenticated/admin/users')({
	component: UsersPage,
})
