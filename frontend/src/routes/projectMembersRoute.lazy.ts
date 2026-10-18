import { createLazyRoute } from '@tanstack/react-router'

import MembersPage from '@/pages/MembersPage/MembersPage'

export const Route = createLazyRoute('/_authenticated/_app/projects/$projectSlug/members')({
	component: MembersPage,
})
