import { createLazyRoute } from '@tanstack/react-router'

import UserPage from '@/pages/UserPage/UserPage'

export const Route = createLazyRoute('/_authenticated/_app/admin/users/$userId')({
	component: UserPage,
})
