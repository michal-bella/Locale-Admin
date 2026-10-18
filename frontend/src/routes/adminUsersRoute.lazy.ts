import { createLazyRoute } from '@tanstack/react-router'

import UsersPage from '@/pages/UsersPage/UsersPage'

export const Route = createLazyRoute('/_authenticated/_app/admin/users')({
	component: UsersPage,
})
