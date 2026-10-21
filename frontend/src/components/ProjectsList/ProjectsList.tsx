import { ActionIcon, Button, Progress, Skeleton, Text, Tooltip, VisuallyHidden } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { Link } from '@tanstack/react-router'
import { type KeyboardEvent, type ReactNode, useEffect, useEffectEvent, useId, useLayoutEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useTranslation } from 'react-i18next'
import Sortable from 'sortablejs'

import { type ProjectListItem, ROLE } from '@locale/shared'

import { useMeQuery } from '@/api/auth/meQuery'
import getApiErrorCode from '@/api/getApiErrorCode'
import { useProjectsQuery } from '@/api/projects/projectsQuery'
import { useReorderProjectsMutation } from '@/api/projects/useReorderProjectsMutation'
import { GripVertical, LogOut, Settings } from '@/components/Icons'
import LanguageFlag from '@/components/LanguageFlag/LanguageFlag'
import { formatDate } from '@/lib/formatDate'
import { formatShare } from '@/lib/formatShare'
import { findSupportedLanguage } from '@/lib/languageOptions'
import { getProjectInitials, isLightColor } from '@/lib/utils'

import classes from './ProjectsList.module.css'
import { type ProjectsListProps } from './types'

const SKELETON_ROWS = 2

const SORT_ANIMATION_MS = 150

/** Share of filled values over all keys × languages, as in the old system; the bar is decorative, the texts under it say the same. */
const ProjectProgress = ({ project }: { project: ProjectListItem }) => {
	const { t, i18n } = useTranslation()
	const total = project.keyCount * project.languageTags.length

	if (total === 0) {
		return (
			<Text size='xs' c='var(--app-color-muted)'>
				{t('projectsPage.list.noKeys')}
			</Text>
		)
	}

	const untranslatedCount = total - project.translatedCount
	const label = (key: 'translated' | 'untranslated', part: number) => {
		const { percent, bound } = formatShare(part, total, i18n.language)
		return t(`projectsPage.list.${key}`, { percent: bound ? t(`projectsPage.list.${bound}`, { percent }) : percent })
	}

	return (
		<div className='flex flex-col gap-1.5'>
			<Progress.Root size={6} radius='xl' aria-hidden classNames={{ root: classes.track }}>
				<Progress.Section value={(project.translatedCount / total) * 100} color='teal' />
			</Progress.Root>
			<div className='flex flex-wrap justify-between gap-x-3 text-xs'>
				<span className={classes.legend} data-tone='translated'>
					{label('translated', project.translatedCount)}
				</span>
				{untranslatedCount > 0 && (
					<span className={classes.legend} data-tone='untranslated'>
						{label('untranslated', untranslatedCount)}
					</span>
				)}
			</div>
		</div>
	)
}

/**
 * Projects of the user in a card: key count, translation progress and the language flags as in the old system. The grip
 * reorders them for this user only: SortableJS drag and drop (the other rows slide aside while dragging), or ArrowUp / ArrowDown while the
 * grip has the focus; a live region says the new place.
 */
const ProjectsList = ({ onLeave }: ProjectsListProps) => {
	const { t, i18n } = useTranslation()
	const { data: user } = useMeQuery()
	const { data, isPending, isError, error, refetch, isRefetching } = useProjectsQuery()
	const listRef = useRef<HTMLUListElement>(null)
	const [retrySucceeded, setRetrySucceeded] = useState(false)
	const reorder = useReorderProjectsMutation()
	const [announcement, setAnnouncement] = useState('')
	const moveHintId = useId()
	const gripRefs = useRef(new Map<string, HTMLButtonElement>())
	const [keyboardMovedId, setKeyboardMovedId] = useState<string | null>(null)
	// The optimistic cache update of the mutation reaches the list only later; until then the dropped order is rendered from here.
	// It is tied to the list it was made from, so any newer data (the cache update, an error rollback, a refetch) replaces it.
	const [dropped, setDropped] = useState<{ from: typeof data; ids: string[] } | null>(null)
	const droppedIds = dropped && dropped.from === data ? dropped.ids : null
	const position = new Map(droppedIds?.map((id, index) => [id, index]))
	const projects = droppedIds ? [...(data?.projects ?? [])].sort((a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0)) : data?.projects

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
		const name = projects?.find((project) => project.id === movedId)?.name ?? ''
		setAnnouncement(t('projectsPage.list.moved', { name, position: projectIds.indexOf(movedId) + 1, count: projectIds.length }))
		reorder.mutate(projectIds, { onError: (err) => notifications.show({ color: 'red', message: t(`errors.${getApiErrorCode(err)}`) }) })
	}

	const moveBy = (projectId: string, offset: number) => {
		const ids = projects?.map((project) => project.id) ?? []
		const from = ids.indexOf(projectId)
		const to = from + offset
		if (from === -1 || to < 0 || to >= ids.length) {
			return
		}
		ids.splice(from, 1)
		ids.splice(to, 0, projectId)
		saveOrder(ids, projectId)
	}

	const onSorted = useEffectEvent((oldIndex: number, newIndex: number) => {
		const ids = projects?.map((project) => project.id) ?? []
		const [moved] = ids.splice(oldIndex, 1)
		if (moved) {
			ids.splice(newIndex, 0, moved)
			// Renders the new order before the browser paints the row SortableJS was just put back at; otherwise it flashes at its old place.
			flushSync(() => setDropped({ from: data, ids }))
			saveOrder(ids, moved)
		}
	})

	const canReorder = (data?.projects.length ?? 0) > 1

	const createdOn = (project: ProjectListItem) => t('projectsPage.list.createdOn', { date: formatDate(project.createdAt, i18n.language) })

	useEffect(() => {
		const list = listRef.current
		if (!list || !canReorder) {
			return
		}
		const sortable = Sortable.create(list, {
			handle: `.${classes.grip}`,
			animation: SORT_ANIMATION_MS,
			ghostClass: classes.ghost,
			chosenClass: classes.chosen,
			onEnd: ({ item, from, oldIndex, newIndex }) => {
				if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) {
					return
				}
				// SortableJS moved the node itself; put it back so React's DOM matches its render, then React reorders the rows from the new list.
				from.insertBefore(item, from.children[oldIndex < newIndex ? oldIndex : oldIndex + 1] ?? null)
				onSorted(oldIndex, newIndex)
			},
		})
		return () => sortable.destroy()
	}, [canReorder])

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
		return (
			<div className={classes.card}>
				{state(<Text size='sm'>{t(user?.role === ROLE.ADMIN ? 'projectsPage.list.empty' : 'projectsPage.list.emptyEditor')}</Text>)}
			</div>
		)
	}

	return (
		<>
			<ul ref={listRef} tabIndex={-1} aria-label={t('projectsPage.list.label')} className={classes.card}>
				{(projects ?? []).map((project) => (
					<li key={project.id} className={`${classes.row} flex flex-wrap items-center gap-4 lg:flex-nowrap`}>
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
						<div className='flex min-w-0 flex-1 flex-col lg:max-w-56'>
							<Link to='/projects/$projectSlug/translations' params={{ projectSlug: project.slug }} className={classes.name}>
								{project.name}
							</Link>
							<Text component='span' size='xs' c='var(--app-color-muted)' className={classes.slug}>
								{project.slug}
							</Text>
							{/* Below lg the name column is too narrow for the date; it moves to the counts on the stats line. */}
							<Text component='span' size='xs' c='var(--app-color-muted)' className='hidden lg:inline'>
								{createdOn(project)}
							</Text>
						</div>
						<div className={classes.stats}>
							<div className='flex shrink-0 flex-col gap-0.5 lg:w-24 lg:text-right'>
								<Text size='sm' c='var(--app-color-text-strong)'>
									{t('projectsPage.list.keys', { count: project.keyCount })}
								</Text>
								<Text size='xs' c='var(--app-color-muted)'>
									{t('projectsPage.list.members', { count: project.memberCount })}
								</Text>
								<Text size='xs' c='var(--app-color-muted)' className='lg:hidden'>
									{createdOn(project)}
								</Text>
							</div>
							<div className='order-last min-w-0 basis-full lg:order-none lg:flex-1 lg:basis-auto'>
								<ProjectProgress project={project} />
							</div>
							<ul aria-label={t('projectsPage.list.languages', { name: project.name })} className={classes.flags}>
								{project.languageTags.map((tag) => {
									const language = findSupportedLanguage(tag)
									return (
										language && (
											<Tooltip key={tag} label={language.englishName}>
												<li>
													<LanguageFlag code={language.flagCode} size='sm' />
													<VisuallyHidden>{language.englishName}</VisuallyHidden>
												</li>
											</Tooltip>
										)
									)
								})}
							</ul>
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
