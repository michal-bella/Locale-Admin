import { createLazyRoute } from '@tanstack/react-router'

import ProfilePage from '@/pages/ProfilePage/ProfilePage'

export const Route = createLazyRoute('/_authenticated/_app/profile')({
	component: ProfilePage,
})
