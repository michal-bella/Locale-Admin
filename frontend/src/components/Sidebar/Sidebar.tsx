import { AppShell, Burger } from '@mantine/core'
import { Link, type LinkProps } from '@tanstack/react-router'
import { type ComponentType, type SVGProps, useId } from 'react'
import { useTranslation } from 'react-i18next'

import { ROLE } from '@locale/shared'

import { useMeQuery } from '@/api/auth/meQuery'
import Brand from '@/components/Brand/Brand'
import { Globe, Users } from '@/components/Icons'
import UserMenu from '@/components/UserMenu/UserMenu'

import classes from './Sidebar.module.css'
import { type SidebarProps } from './types'

type NavItemProps = {
	to: LinkProps['to']
	icon: ComponentType<SVGProps<SVGSVGElement>>
	label: string
	onNavigate: () => void
}

const NavItem = ({ to, icon: Icon, label, onNavigate }: NavItemProps) => (
	<li>
		<Link to={to} className={classes.link} onClick={onNavigate}>
			{({ isActive }) => (
				<>
					<Icon aria-hidden className={classes.icon} />
					<span className={classes.label}>{label}</span>
					{isActive && <span aria-hidden className={classes.dot} />}
				</>
			)}
		</Link>
	</li>
)

/** Sidebar of Figma 3:1656 with only the pages that exist: Jazyky and, under SPRÁVA, Používatelia (both ADMIN only), user block at the bottom. */
const Sidebar = ({ id, opened, onClose }: SidebarProps) => {
	const { t } = useTranslation()
	const { data: user } = useMeQuery()
	const adminLabelId = useId()
	const isAdmin = user?.role === ROLE.ADMIN

	return (
		<AppShell.Navbar id={id} component='aside' withBorder={false} mod={{ collapsed: !opened }} className={classes.root}>
			<div className='flex items-center justify-between'>
				<Link to='/' activeOptions={{ exact: true }} aria-label={t('sidebar.home')} className={classes.brandLink} onClick={onClose}>
					<Brand />
				</Link>
				<Burger hiddenFrom='md' size='sm' opened={opened} onClick={onClose} aria-label={t('sidebar.closeNavigation')} />
			</div>
			<nav aria-label={t('sidebar.label')} className={classes.nav}>
				{isAdmin && (
					<>
						<ul className={classes.list}>
							<NavItem to='/languages' icon={Globe} label={t('sidebar.languages')} onNavigate={onClose} />
						</ul>
						<hr className={classes.divider} />
						<p id={adminLabelId} className={classes.sectionLabel}>
							{t('sidebar.admin')}
						</p>
						<ul aria-labelledby={adminLabelId} className={classes.list}>
							<NavItem to='/admin/users' icon={Users} label={t('sidebar.users')} onNavigate={onClose} />
						</ul>
					</>
				)}
			</nav>
			<UserMenu onNavigate={onClose} />
		</AppShell.Navbar>
	)
}

export default Sidebar
