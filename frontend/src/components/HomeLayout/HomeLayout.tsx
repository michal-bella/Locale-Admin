import { AppShell } from '@mantine/core'
import { Link, Outlet } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import Brand from '@/components/Brand/Brand'
import TopBar from '@/components/TopBar/TopBar'
import UserMenu from '@/components/UserMenu/UserMenu'

import classes from './HomeLayout.module.css'

/** Layout of the project list: top bar with the brand instead of a sidebar, which needs an opened project. */
const HomeLayout = () => {
	const { t } = useTranslation()

	return (
		<AppShell header={{ height: 64 }}>
			<TopBar
				start={
					<Link to='/' aria-label={t('sidebar.home')} className={classes.brandLink}>
						<Brand />
					</Link>
				}
				end={<UserMenu />}
			/>
			<AppShell.Main className='flex flex-col'>
				<Outlet />
			</AppShell.Main>
		</AppShell>
	)
}

export default HomeLayout
