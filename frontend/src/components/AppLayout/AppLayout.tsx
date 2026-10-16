import { Outlet } from '@tanstack/react-router'

import TopBar from '@/components/TopBar/TopBar'

/** Layout of every signed-in page: top bar and the route content. No sidebar in phase 1. */
const AppLayout = () => (
	<div className='flex min-h-dvh flex-col'>
		<TopBar />
		<main className='flex flex-1 flex-col'>
			<Outlet />
		</main>
	</div>
)

export default AppLayout
