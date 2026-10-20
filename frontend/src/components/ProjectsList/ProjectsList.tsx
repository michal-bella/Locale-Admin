import { ActionIcon, Button, Skeleton, Text, Tooltip, VisuallyHidden } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { Link } from '@tanstack/react-router'
import { type DragEvent, type KeyboardEvent, type ReactNode, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import getApiErrorCode from '@/api/getApiErrorCode'
import { useProjectsQuery } from '@/api/projects/projectsQuery'
import { useReorderProjectsMutation } from '@/api/projects/useReorderProjectsMutation'
import { GripVertical, LogOut, Settings } from '@/components/Icons'
import { getProjectInitials, isLightColor } from '@/lib/utils'

import classes from './ProjectsList.module.css'
import { type ProjectsListProps } from './types'

const SKELETON_ROWS = 2

type DropTarget = { id: string; side: 'before' | 'after' }

/**
 * Projects of the user in a card (rows as in the old system without keys, progress and flags, which come with translations). The grip
 * reorders them for this user only: native drag and drop, or ArrowUp / ArrowDown while the grip has the focus; a live region says the new place.
 */
const ProjectsList = ({ onLeave }: ProjectsListProps) => {
	const { t } = useTranslation()
	const { data, isPending, isError, error, refetch, isRefetching } = useProjectsQuery()
	const listRef = useRef<HTMLUListElement>(null)
	const [retrySucceeded, setRetrySucceeded] = useState(false)
	const reorder = useReorderProjectsMutation()
	const [draggedId, setDraggedId] = useState<string | null>(null)
	const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)
	const [announcement, setAnnouncement] = useState('')
	const moveHintId = useId()
	const gripRefs = useRef(new Map<string, HTMLButtonElement>())
	const [keyboardMovedId, setKeyboardMovedId] = useState<string | null>(null)

	// React may move the focused row in the DOM, which drops the focus to the body; the moved project's grip takes it back.
	useLayoutEffect(() => {
		if (keyboardMovedId && (document.activeElement === null || document.activeElement === document.body)) {
			gripRefs.current.get(keyboardMovedId)?.focus()
		}
	}, [keyboardMovedId, data])

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

	const saveOrder = (projectIds: string[], movedId: string) => {
		const name = data?.projects.find((project) => project.id === movedId)?.name ?? ''
		setAnnouncement(t('projectsPage.list.moved', { name, position: projectIds.indexOf(movedId) + 1, count: projectIds.length }))
		reorder.mutate(projectIds, { onError: (err) => notifications.show({ color: 'red', message: t(`errors.${getApiErrorCode(err)}`) }) })
	}

	const moveBy = (projectId: string, offset: number) => {
		const ids = data?.projects.map((project) => project.id) ?? []
		const from = ids.indexOf(projectId)
		const to = from + offset
		if (from === -1 || to < 0 || to >= ids.length) {
			return
		}
		ids.splice(from, 1)
		ids.splice(to, 0, projectId)
		saveOrder(ids, projectId)
	}

	const dropOn = (target: DropTarget) => {
		if (!draggedId || draggedId === target.id) {
			return
		}
		const ids = (data?.projects.map((project) => project.id) ?? []).filter((id) => id !== draggedId)
		ids.splice(ids.indexOf(target.id) + (target.side === 'after' ? 1 : 0), 0, draggedId)
		saveOrder(ids, draggedId)
	}

	const endDrag = () => {
		setDraggedId(null)
		setDropTarget(null)
	}

	const dragOver = (event: DragEvent<HTMLLIElement>, id: string) => {
		if (!draggedId) {
			return
		}
		event.preventDefault()
		const { top, height } = event.currentTarget.getBoundingClientRect()
		const side = event.clientY < top + height / 2 ? 'before' : 'after'
		if (dropTarget?.id !== id || dropTarget.side !== side) {
			setDropTarget({ id, side })
		}
	}

	const gripKeyDown = (event: KeyboardEvent<HTMLButtonElement>, id: string) => {
		if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
			event.preventDefault()
			setKeyboardMovedId(id)
			moveBy(id, event.key === 'ArrowUp' ? -1 : 1)
		}
	}

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

	const canReorder = data.projects.length > 1

	return (
		<>
			<ul ref={listRef} tabIndex={-1} aria-label={t('projectsPage.list.label')} className={classes.card}>
				{data.projects.map((project) => (
					<li
						key={project.id}
						className={`${classes.row} flex items-center gap-4`}
						data-dragging={draggedId === project.id || undefined}
						data-drop={dropTarget?.id === project.id ? dropTarget.side : undefined}
						onDragOver={(event) => dragOver(event, project.id)}
						onDrop={(event) => {
							event.preventDefault()
							if (dropTarget) {
								dropOn(dropTarget)
							}
							endDrag()
						}}
					>
						{canReorder && (
							<Tooltip label={t('projectsPage.list.move')}>
								<ActionIcon
									variant='transparent'
									size={32}
									radius='md'
									aria-label={t('projectsPage.list.moveLabel', { name: project.name })}
									aria-describedby={moveHintId}
									ref={(element) => {
										if (element) {
											gripRefs.current.set(project.id, element)
										} else {
											gripRefs.current.delete(project.id)
										}
									}}
									onBlur={(event) => {
										// A blur from the DOM move has no relatedTarget; only a real focus change ends the keyboard move.
										if (event.relatedTarget) {
											setKeyboardMovedId(null)
										}
									}}
									className={`${classes.action} ${classes.grip}`}
									draggable
									onDragStart={(event) => {
										event.dataTransfer.effectAllowed = 'move'
										event.dataTransfer.setData('text/plain', project.id)
										// The whole row follows the pointer, not just the grip.
										const row = event.currentTarget.closest('li')
										if (row) {
											event.dataTransfer.setDragImage(row, 24, row.offsetHeight / 2)
										}
										setDraggedId(project.id)
									}}
									onDragEnd={endDrag}
									onKeyDown={(event) => gripKeyDown(event, project.id)}
								>
									<GripVertical aria-hidden />
								</ActionIcon>
							</Tooltip>
						)}
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
			<VisuallyHidden id={moveHintId}>{t('projectsPage.list.moveHint')}</VisuallyHidden>
			<VisuallyHidden role='status'>{announcement}</VisuallyHidden>
		</>
	)
}

export default ProjectsList
