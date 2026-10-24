import { createLazyRoute } from '@tanstack/react-router'

import HistoryPage from '@/pages/HistoryPage/HistoryPage'

export const Route = createLazyRoute('/_authenticated/_app/projects/$projectSlug/history')({
	component: HistoryPage,
})
