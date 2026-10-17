import { AppShell } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { Outlet } from '@tanstack/react-router'
import { useId } from 'react'

import Sidebar from '@/components/Sidebar/Sidebar'
import TopBar from '@/components/TopBar/TopBar'

/** Layout of every signed-in page: fixed full-height sidebar (off-canvas below `md`), top bar and the scrolling route content. */
const AppLayout = () => {
	const [navOpened, nav] = useDisclosure(false)
	const navbarId = useId()

	return (
		<AppShell layout='alt' header={{ height: 64 }} navbar={{ width: 236, breakpoint: 'md', collapsed: { mobile: !navOpened } }}>
			<TopBar navbarId={navbarId} navOpened={navOpened} onToggleNav={nav.toggle} />
			<Sidebar id={navbarId} opened={navOpened} onClose={nav.close} />
			<AppShell.Main className='flex flex-col'>
				<Outlet />
			</AppShell.Main>
		</AppShell>
	)
}

export default AppLayout
