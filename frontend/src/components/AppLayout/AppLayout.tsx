import { AppShell } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { Outlet } from '@tanstack/react-router'
import { useId, useRef } from 'react'

import Sidebar from '@/components/Sidebar/Sidebar'
import TopBar from '@/components/TopBar/TopBar'
import UserMenu from '@/components/UserMenu/UserMenu'

/** Layout of every signed-in page: fixed full-height sidebar (off-canvas below `md`), top bar with the user menu and the scrolling route content. */
const AppLayout = () => {
	const [navOpened, nav] = useDisclosure(false)
	const navbarId = useId()
	const burgerRef = useRef<HTMLButtonElement>(null)

	// The closed sidebar is hidden, so focus on its burger or a link would be lost.
	const closeNav = () => {
		if (navOpened) {
			burgerRef.current?.focus()
		}
		nav.close()
	}

	return (
		<AppShell layout='alt' header={{ height: 64 }} navbar={{ width: 236, breakpoint: 'md', collapsed: { mobile: !navOpened } }}>
			<TopBar navbarId={navbarId} navOpened={navOpened} onToggleNav={nav.toggle} burgerRef={burgerRef} end={<UserMenu />} />
			<Sidebar id={navbarId} opened={navOpened} onClose={closeNav} />
			<AppShell.Main className='flex flex-col'>
				<Outlet />
			</AppShell.Main>
		</AppShell>
	)
}

export default AppLayout
