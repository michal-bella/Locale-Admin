import { Menu, Text, UnstyledButton } from '@mantine/core'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { useProjectsQuery } from '@/api/projects/projectsQuery'
import { ChevronSelector } from '@/components/Icons'
import { getProjectInitials, isLightColor } from '@/lib/utils'

import classes from './ProjectSwitcher.module.css'
import { type ProjectSwitcherProps } from './types'

const ProjectAvatar = ({ name, primaryColor, size }: { name: string; primaryColor: string; size: 'sm' | 'md' }) => (
	<span
		aria-hidden
		data-size={size}
		data-tone={isLightColor(primaryColor) ? 'dark' : 'light'}
		className={classes.avatar}
		style={{ backgroundColor: primaryColor }}
	>
		{getProjectInitials(name)}
	</span>
)

/**
 * Project switcher at the top of the sidebar (Figma 3:470). The second line shows the slug instead of the organization,
 * which no longer exists. Switching keeps Preklady, Prehľad, Jazyky or Členovia; from Nastavenia projektu it opens Preklady.
 */
const ProjectSwitcher = ({ project, onNavigate }: ProjectSwitcherProps) => {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const pathname = useLocation({ select: (location) => location.pathname })
	const { data } = useProjectsQuery()
	const to = pathname.endsWith('/members')
		? '/projects/$projectSlug/members'
		: pathname.endsWith('/languages')
			? '/projects/$projectSlug/languages'
			: pathname.endsWith('/dashboard')
				? '/projects/$projectSlug/dashboard'
				: '/projects/$projectSlug/translations'

	const open = (projectSlug: string) => {
		onNavigate()
		void navigate({ to, params: { projectSlug } })
	}

	return (
		<Menu position='bottom-start' width='target' radius='lg' shadow='md'>
			<Menu.Target>
				<UnstyledButton
					aria-label={t('sidebar.projectSwitcher.label', { name: project.name })}
					className={`${classes.trigger} flex items-center gap-3`}
				>
					<ProjectAvatar name={project.name} primaryColor={project.primaryColor} size='md' />
					<span className='flex min-w-0 flex-1 flex-col'>
						<Text component='span' fz='xs' fw={600} lh='xs' c='var(--app-color-text-strong)' truncate>
							{project.name}
						</Text>
						<Text component='span' fz='3xs' lh={1.5} c='var(--app-color-muted)' truncate>
							{project.slug}
						</Text>
					</span>
					<ChevronSelector aria-hidden className={classes.chevron} />
				</UnstyledButton>
			</Menu.Target>
			{/* An ADMIN sees every project, so the list scrolls instead of running off the screen. */}
			<Menu.Dropdown className={classes.dropdown}>
				<Menu.Label>{t('sidebar.projectSwitcher.projects')}</Menu.Label>
				{data?.projects.map((item) => (
					<Menu.Item
						key={item.id}
						leftSection={<ProjectAvatar name={item.name} primaryColor={item.primaryColor} size='sm' />}
						aria-current={item.id === project.id ? 'true' : undefined}
						className={classes.item}
						onClick={() => open(item.slug)}
					>
						{item.name}
					</Menu.Item>
				))}
				<Menu.Divider />
				<Menu.Item
					onClick={() => {
						onNavigate()
						void navigate({ to: '/' })
					}}
				>
					{t('sidebar.allProjects')}
				</Menu.Item>
			</Menu.Dropdown>
		</Menu>
	)
}

export default ProjectSwitcher
