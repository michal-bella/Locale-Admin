import { AppShell } from '@mantine/core'
import { useDisclosure, useLocalStorage } from '@mantine/hooks'
import { Outlet } from '@tanstack/react-router'
import { useId, useRef } from 'react'

import Sidebar from '@/components/Sidebar/Sidebar'
import TopBar from '@/components/TopBar/TopBar'
import UserMenu from '@/components/UserMenu/UserMenu'
import { SIDEBAR_COMPACT_STORAGE_KEY } from '@/lib/constants'

/**
 * Layout of every signed-in page: fixed full-height sidebar (off-canvas below `md`, from `md` full or compact with icons only, remembered
 * in localStorage), top bar with the user menu and the scrolling route content.
 */
const AppLayout = () => {
	const [navOpened, nav] = useDisclosure(false)
	const navbarId = useId()
	const burgerRef = useRef<HTMLButtonElement>(null)
	const [compactNav, setCompactNav] = useLocalStorage({ key: SIDEBAR_COMPACT_STORAGE_KEY, defaultValue: false, getInitialValueInEffect: false })

	// The closed sidebar is hidden, so focus on its burger or a link would be lost.
	const closeNav = () => {
		if (navOpened) {
			burgerRef.current?.focus()
		}
		nav.close()
	}

	return (
		<AppShell
			layout='alt'
			header={{ height: 64 }}
			navbar={{ width: { base: 236, md: compactNav ? 80 : 236 }, breakpoint: 'md', collapsed: { mobile: !navOpened } }}
		>
			<TopBar navbarId={navbarId} navOpened={navOpened} onToggleNav={nav.toggle} burgerRef={burgerRef} end={<UserMenu />} />
			<Sidebar id={navbarId} opened={navOpened} onClose={closeNav} compact={compactNav} onToggleCompact={() => setCompactNav((value) => !value)} />
			<AppShell.Main className='flex flex-col'>
				<Outlet />
			</AppShell.Main>
		</AppShell>
	)
}

export default AppLayout
