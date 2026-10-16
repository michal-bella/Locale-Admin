import { createLazyRoute } from '@tanstack/react-router'

import LoginPage from '@/pages/LoginPage/LoginPage'

export const Route = createLazyRoute('/login')({
	component: LoginPage,
})
