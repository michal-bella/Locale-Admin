import { ActionIcon, Button, Skeleton, Text, Tooltip } from '@mantine/core'
import { Link } from '@tanstack/react-router'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import getApiErrorCode from '@/api/getApiErrorCode'
import { useProjectsQuery } from '@/api/projects/projectsQuery'
import { LogOut, Settings } from '@/components/Icons'
import { getProjectInitials, isLightColor } from '@/lib/utils'

import classes from './ProjectsList.module.css'
import { type ProjectsListProps } from './types'

const SKELETON_ROWS = 2

/** Projects of the user in a card (rows as in the old system without keys, progress and flags, which come with translations). */
const ProjectsList = ({ onLeave }: ProjectsListProps) => {
	const { t } = useTranslation()
	const { data, isPending, isError, error, refetch, isRefetching } = useProjectsQuery()
	const listRef = useRef<HTMLUListElement>(null)
	const [retrySucceeded, setRetrySucceeded] = useState(false)

	// A successful retry replaces the focused retry button with the rows; the list exists only after that render.
	useEffect(() => {
		if (retrySucceeded) {
			listRef.current?.focus()
		}
	}, [retrySucceeded])

	const retry = async () => {
		const { isSuccess } = await refetch()
		setRetrySucceeded(isSuccess)
	}

	const state = (content: ReactNode) => <div className={classes.state}>{content}</div>

	if (isPending) {
		return (
			<div aria-busy='true' className={classes.card}>
				{Array.from({ length: SKELETON_ROWS }, (_, index) => (
					<div key={index} className={`${classes.row} flex items-center gap-4`}>
						<Skeleton height={48} width={48} radius='md' />
						<Skeleton height={12} width='30%' radius='sm' />
					</div>
				))}
			</div>
		)
	}

	if (isError) {
		return (
			<div className={classes.card}>
				{state(
					<div className='flex flex-col items-center gap-1'>
						<Text size='sm' fw={600} c='var(--app-color-text-strong)'>
							{t('projectsPage.list.loadError')}
						</Text>
						<Text size='xs'>{t(`errors.${getApiErrorCode(error)}`)}</Text>
						<Button variant='default' mt='md' loading={isRefetching} onClick={() => void retry()}>
							{t('projectsPage.list.retry')}
						</Button>
					</div>,
				)}
			</div>
		)
	}

	if (data.projects.length === 0) {
		return <div className={classes.card}>{state(<Text size='sm'>{t('projectsPage.list.empty')}</Text>)}</div>
	}

	return (
		<ul ref={listRef} tabIndex={-1} aria-label={t('projectsPage.list.label')} className={classes.card}>
			{data.projects.map((project) => (
				<li key={project.id} className={`${classes.row} flex items-center gap-4`}>
					<span
						aria-hidden
						data-tone={isLightColor(project.primaryColor) ? 'dark' : 'light'}
						className={classes.avatar}
						style={{ backgroundColor: project.primaryColor }}
					>
						{getProjectInitials(project.name)}
					</span>
					<div className='flex min-w-0 flex-1 flex-col'>
						<Link to='/projects/$projectSlug/translations' params={{ projectSlug: project.slug }} className={classes.name}>
							{project.name}
						</Link>
						<Text component='span' size='xs' c='var(--app-color-muted)' className={classes.slug}>
							{project.slug}
						</Text>
					</div>
					<div className='flex shrink-0 items-center gap-1'>
						<Tooltip label={t('projectsPage.list.settings')}>
							<ActionIcon
								renderRoot={(props) => <Link {...props} to='/projects/$projectSlug/settings' params={{ projectSlug: project.slug }} />}
								variant='transparent'
								size={32}
								radius='md'
								aria-label={t('projectsPage.list.settingsLabel', { name: project.name })}
								className={classes.action}
							>
								<Settings aria-hidden />
							</ActionIcon>
						</Tooltip>
						{project.isMember ? (
							<Tooltip label={t('projectsPage.list.leave')}>
								<ActionIcon
									variant='transparent'
									size={32}
									radius='md'
									aria-label={t('projectsPage.list.leaveLabel', { name: project.name })}
									className={classes.action}
									data-variant='danger'
									onClick={() => onLeave(project)}
								>
									<LogOut aria-hidden />
								</ActionIcon>
							</Tooltip>
						) : (
							// Keeps the settings icons of all rows in one column.
							<span aria-hidden className='size-8' />
						)}
					</div>
				</li>
			))}
		</ul>
	)
}

export default ProjectsList
