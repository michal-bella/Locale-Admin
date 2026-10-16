import { createRoute } from '@tanstack/react-router'

import { ROLE } from '@locale/shared'

import RouteError from '@/components/RouteError/RouteError'
import { ForbiddenError } from '@/lib/forbiddenError'
import UsersPage from '@/pages/UsersPage/UsersPage'
import { authenticatedRoute } from '@/routes/authenticatedRoute'

export const adminUsersRoute = createRoute({
	getParentRoute: () => authenticatedRoute,
	path: '/admin/users',
	beforeLoad: ({ context }) => {
		if (context.user.role !== ROLE.ADMIN) {
			throw new ForbiddenError()
		}
	},
	component: UsersPage,
	errorComponent: RouteError,
})
