import { ActionIcon, AppShell, Burger, Tooltip, VisuallyHidden } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { Link, type LinkProps, useMatch } from '@tanstack/react-router'
import { type ComponentType, type SVGProps, useId } from 'react'
import { useTranslation } from 'react-i18next'

import { ROLE } from '@locale/shared'

import { useMeQuery } from '@/api/auth/meQuery'
import { projectSettingsQueryOptions } from '@/api/projectSettings/projectSettingsQuery'
import Brand from '@/components/Brand/Brand'
import { ArrowRight, ChevronDown, Globe, LayoutGrid, Settings, Shield, Translate, Users } from '@/components/Icons'
import ProjectSwitcher from '@/components/ProjectSwitcher/ProjectSwitcher'

import classes from './Sidebar.module.css'
import { type SidebarProps } from './types'

type NavItemProps = {
	to: LinkProps['to']
	params?: LinkProps['params']
	icon: ComponentType<SVGProps<SVGSVGElement>>
	iconClassName?: string
	label: string
	compact: boolean
	onNavigate: () => void
}

const NavItem = ({ to, params, icon: Icon, iconClassName = '', label, compact, onNavigate }: NavItemProps) => (
	<li>
		<Tooltip label={label} position='right' disabled={!compact}>
			<Link to={to} params={params} activeOptions={{ exact: to === '/' }} className={classes.link} onClick={onNavigate}>
				{({ isActive }) => (
					<>
						<Icon aria-hidden className={`${classes.icon} ${iconClassName}`} />
						{compact ? <VisuallyHidden>{label}</VisuallyHidden> : <span className={classes.label}>{label}</span>}
						{isActive && !compact && <span aria-hidden className={classes.dot} />}
					</>
				)}
			</Link>
		</Tooltip>
	</li>
)

/**
 * Sidebar of Figma 3:1656 with only the pages that exist. Inside a project: the project switcher (Figma 3:470) with Preklady,
 * Prehľad, Nastavenia projektu, Jazyky and Členovia (Preklady stay first, Prehľad is not the project's landing page), outside one: Všetky projekty. ADMIN also sees Projekty and Používatelia under SPRÁVA.
 * From `md` the button at the bottom switches to the compact sidebar: logo, project avatar and icons with tooltips.
 */
const Sidebar = ({ id, opened, onClose, compact, onToggleCompact }: SidebarProps) => {
	const { t } = useTranslation()
	const { data: user } = useMeQuery()
	const projectMatch = useMatch({ from: '/_authenticated/_app/projects/$projectSlug', shouldThrow: false })
	const projectSlug = projectMatch?.params.projectSlug
	const projectId = projectMatch?.loaderData?.projectId
	// Only reads the cache: the project route loads the settings, and a project the user cannot open must not be refetched here.
	const { data: project } = useQuery({ ...projectSettingsQueryOptions(projectId ?? ''), enabled: false })
	const adminLabelId = useId()
	const isAdmin = user?.role === ROLE.ADMIN
	// The burger opens the sidebar only below `md`, where it must show the labels.
	const isCompact = compact && !opened
	const toggleLabel = isCompact ? t('sidebar.expand') : t('sidebar.collapse')

	return (
		<AppShell.Navbar id={id} component='aside' withBorder={false} mod={{ collapsed: !opened, compact: isCompact }} className={classes.root}>
			<div className={`${classes.header} flex items-center justify-between`}>
				<Link to='/' activeOptions={{ exact: true }} aria-label={t('sidebar.home')} className={classes.brandLink} onClick={onClose}>
					<Brand compact={isCompact} />
				</Link>
				<Burger hiddenFrom='md' size='sm' opened={opened} onClick={onClose} aria-label={t('sidebar.closeNavigation')} />
			</div>
			{projectSlug && project && (
				<div className={classes.switcher}>
					<ProjectSwitcher project={project} onNavigate={onClose} compact={isCompact} />
				</div>
			)}
			<nav aria-label={t('sidebar.label')} className={classes.nav}>
				{projectSlug && project ? (
					<ul aria-label={project.name} className={classes.list}>
						<NavItem
							to='/projects/$projectSlug/translations'
							params={{ projectSlug }}
							icon={Translate}
							label={t('sidebar.translations')}
							compact={isCompact}
							onNavigate={onClose}
						/>
						<NavItem
							to='/projects/$projectSlug/dashboard'
							params={{ projectSlug }}
							icon={LayoutGrid}
							label={t('sidebar.dashboard')}
							compact={isCompact}
							onNavigate={onClose}
						/>
						<NavItem
							to='/projects/$projectSlug/settings'
							params={{ projectSlug }}
							icon={Settings}
							label={t('sidebar.projectSettings')}
							compact={isCompact}
							onNavigate={onClose}
						/>
						<NavItem
							to='/projects/$projectSlug/languages'
							params={{ projectSlug }}
							icon={Globe}
							label={t('sidebar.languages')}
							compact={isCompact}
							onNavigate={onClose}
						/>
						<NavItem
							to='/projects/$projectSlug/members'
							params={{ projectSlug }}
							icon={Users}
							label={t('sidebar.members')}
							compact={isCompact}
							onNavigate={onClose}
						/>
					</ul>
				) : (
					<ul className={classes.list}>
						<NavItem
							to='/'
							icon={ArrowRight}
							iconClassName='rotate-180'
							label={t('sidebar.allProjects')}
							compact={isCompact}
							onNavigate={onClose}
						/>
					</ul>
				)}
				{isAdmin && (
					<>
						<hr className={classes.divider} />
						{isCompact ? (
							<VisuallyHidden id={adminLabelId}>{t('sidebar.admin')}</VisuallyHidden>
						) : (
							<p id={adminLabelId} className={classes.sectionLabel}>
								{t('sidebar.admin')}
							</p>
						)}
						<ul aria-labelledby={adminLabelId} className={classes.list}>
							<NavItem to='/admin/projects' icon={Shield} label={t('sidebar.adminProjects')} compact={isCompact} onNavigate={onClose} />
							<NavItem to='/admin/users' icon={Users} label={t('sidebar.users')} compact={isCompact} onNavigate={onClose} />
						</ul>
					</>
				)}
			</nav>
			<div className={classes.footer}>
				<Tooltip label={toggleLabel} position='right' disabled={!isCompact}>
					<ActionIcon
						visibleFrom='md'
						variant='subtle'
						color='gray'
						size='lg'
						radius='lg'
						aria-label={toggleLabel}
						aria-expanded={!isCompact}
						aria-controls={id}
						onClick={onToggleCompact}
					>
						<ChevronDown aria-hidden className={isCompact ? '-rotate-90' : 'rotate-90'} />
					</ActionIcon>
				</Tooltip>
			</div>
		</AppShell.Navbar>
	)
}

export default Sidebar
