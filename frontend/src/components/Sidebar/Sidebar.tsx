import { AppShell, Burger } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { Link, type LinkProps, useParams } from '@tanstack/react-router'
import { type ComponentType, type SVGProps, useId } from 'react'
import { useTranslation } from 'react-i18next'

import { ROLE } from '@locale/shared'

import { useMeQuery } from '@/api/auth/meQuery'
import { projectSettingsQueryOptions } from '@/api/projectSettings/projectSettingsQuery'
import Brand from '@/components/Brand/Brand'
import { ArrowRight, Globe, Settings, Users } from '@/components/Icons'
import UserMenu from '@/components/UserMenu/UserMenu'

import classes from './Sidebar.module.css'
import { type SidebarProps } from './types'

type NavItemProps = {
	to: LinkProps['to']
	params?: LinkProps['params']
	icon: ComponentType<SVGProps<SVGSVGElement>>
	iconClassName?: string
	label: string
	onNavigate: () => void
}

const NavItem = ({ to, params, icon: Icon, iconClassName = '', label, onNavigate }: NavItemProps) => (
	<li>
		<Link to={to} params={params} activeOptions={{ exact: to === '/' }} className={classes.link} onClick={onNavigate}>
			{({ isActive }) => (
				<>
					<Icon aria-hidden className={`${classes.icon} ${iconClassName}`} />
					<span className={classes.label}>{label}</span>
					{isActive && <span aria-hidden className={classes.dot} />}
				</>
			)}
		</Link>
	</li>
)

/**
 * Sidebar of Figma 3:1656 with only the pages that exist. Inside a project: its name with Nastavenia projektu and Členovia.
 * ADMIN also sees Jazyky and, under SPRÁVA, Používatelia. User block at the bottom.
 */
const Sidebar = ({ id, opened, onClose }: SidebarProps) => {
	const { t } = useTranslation()
	const { data: user } = useMeQuery()
	const { projectId } = useParams({ strict: false })
	// Only reads the cache: the project route loads the settings, and a project the user cannot open must not be refetched here.
	const { data: project } = useQuery({ ...projectSettingsQueryOptions(projectId ?? ''), enabled: false })
	const projectLabelId = useId()
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
				<ul className={classes.list}>
					<NavItem to='/' icon={ArrowRight} iconClassName='rotate-180' label={t('sidebar.allProjects')} onNavigate={onClose} />
				</ul>
				{projectId && project && (
					<>
						<hr className={classes.divider} />
						<p id={projectLabelId} className={classes.sectionLabel}>
							{project.name}
						</p>
						<ul aria-labelledby={projectLabelId} className={classes.list}>
							<NavItem
								to='/projects/$projectId/settings'
								params={{ projectId }}
								icon={Settings}
								label={t('sidebar.projectSettings')}
								onNavigate={onClose}
							/>
							<NavItem to='/projects/$projectId/members' params={{ projectId }} icon={Users} label={t('sidebar.members')} onNavigate={onClose} />
						</ul>
					</>
				)}
				{isAdmin && (
					<>
						<hr className={classes.divider} />
						<p id={adminLabelId} className={classes.sectionLabel}>
							{t('sidebar.admin')}
						</p>
						<ul aria-labelledby={adminLabelId} className={classes.list}>
							<NavItem to='/admin/users' icon={Users} label={t('sidebar.users')} onNavigate={onClose} />
							<NavItem to='/languages' icon={Globe} label={t('sidebar.languages')} onNavigate={onClose} />
						</ul>
					</>
				)}
			</nav>
			<UserMenu onNavigate={onClose} />
		</AppShell.Navbar>
	)
}

export default Sidebar
