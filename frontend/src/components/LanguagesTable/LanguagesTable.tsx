import { ActionIcon, Badge, Button, Progress, Skeleton, Table, Text, Tooltip, VisuallyHidden } from '@mantine/core'
import { useMergedRef } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { Link } from '@tanstack/react-router'
import { type KeyboardEvent, type ReactNode, useEffect, useEffectEvent, useId, useLayoutEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useTranslation } from 'react-i18next'
import Sortable from 'sortablejs'

import { type Language, type LanguageListItem } from '@locale/shared'

import getApiErrorCode from '@/api/getApiErrorCode'
import { useProjectLanguagesQuery } from '@/api/projectLanguages/projectLanguagesQuery'
import { useReorderProjectLanguagesMutation } from '@/api/projectLanguages/useReorderProjectLanguagesMutation'
import BaseLanguageHint from '@/components/BaseLanguageHint/BaseLanguageHint'
import ChangeBaseLanguageModal from '@/components/ChangeBaseLanguageModal/ChangeBaseLanguageModal'
import { GripVertical, Plus, Translate, Trash } from '@/components/Icons'
import LanguageFlag from '@/components/LanguageFlag/LanguageFlag'
import RowAction from '@/components/RowAction/RowAction'
import { formatShare } from '@/lib/formatShare'

import classes from './LanguagesTable.module.css'
import { type LanguagesTableProps } from './types'

const SKELETON_ROWS = 3

const SORT_ANIMATION_MS = 150

const COLUMN_COUNT = 4

// The base language is the source, so it opens the translations without a preset target.
const translationsSearch = (language: Language) => (language.isBase ? {} : { target: language.tag, languages: [language.tag] })

/**
 * Languages of a project in a card (Figma 3:812, 3:860) without the Na kontrolu column (that status does not exist). The base language cannot be removed.
 * Below 1200 px the Preložené column moves under the progress bar, below 640 px the progress moves under the language name, as in the members table.
 * The grip reorders them for the whole project (the column order of the translations): SortableJS drag and drop, or ArrowUp / ArrowDown
 * while the grip has the focus, as in the project list. The first language is the base, so a move that changes it waits for a confirmation;
 * "Nie" puts the rows back. The name and the Translate icon (for every member) open the translations with that language as the target.
 */
const LanguagesTable = ({ projectId, projectSlug, onAdd, onDelete, reorderable = false, ref }: LanguagesTableProps) => {
	const { t, i18n } = useTranslation()
	const { data, isPending, isError, error, refetch, isRefetching } = useProjectLanguagesQuery(projectId)
	const tableRef = useRef<HTMLTableElement>(null)
	const mergedRef = useMergedRef(tableRef, ref)
	const bodyRef = useRef<HTMLTableSectionElement>(null)
	const reorder = useReorderProjectLanguagesMutation(projectId)
	const [announcement, setAnnouncement] = useState('')
	const moveHintId = useId()
	const gripRefs = useRef(new Map<string, HTMLButtonElement>())
	const [keyboardMovedId, setKeyboardMovedId] = useState<string | null>(null)
	// Same as in ProjectsList: the dropped order is rendered from here until newer data (the optimistic cache update, a rollback) replaces it.
	const [dropped, setDropped] = useState<{ from: typeof data; ids: string[]; movedId: string } | null>(null)
	const droppedIds = dropped && dropped.from === data ? dropped.ids : null
	const position = new Map(droppedIds?.map((id, index) => [id, index]))
	const languages = droppedIds ? [...(data ?? [])].sort((a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0)) : data
	const currentBase = data?.find((language) => language.isBase) ?? null
	const [baseChange, setBaseChange] = useState<{ language: Language; currentBase: Language | null } | null>(null)
	const [baseModalOpened, setBaseModalOpened] = useState(false)

	const languageName = (language: Language) => {
		const name = t(`languageNames.${language.tag}`)
		return name.charAt(0).toLocaleUpperCase(i18n.language) + name.slice(1)
	}

	useLayoutEffect(() => {
		if (keyboardMovedId && (document.activeElement === null || document.activeElement === document.body)) {
			gripRefs.current.get(keyboardMovedId)?.focus()
		}
	}, [keyboardMovedId, data, dropped])

	// A successful retry replaces the focused retry button with the rows.
	const retry = async () => {
		const { isSuccess } = await refetch()
		if (isSuccess) {
			tableRef.current?.focus()
		}
	}

	const saveOrder = (languageIds: string[], movedId: string) => {
		const moved = data?.find((language) => language.id === movedId)
		const newBase = data?.find((language) => language.id === languageIds[0])
		const baseChanged = newBase !== undefined && newBase.id !== currentBase?.id
		if (moved) {
			setAnnouncement(
				t('languagesPage.table.moved', { name: languageName(moved), position: languageIds.indexOf(movedId) + 1, count: languageIds.length }),
			)
		}
		reorder.mutate(languageIds, {
			onSuccess: () => {
				if (baseChanged) {
					notifications.show({ color: 'green', message: t('languagesPage.baseModal.success', { name: languageName(newBase) }) })
				}
			},
			onError: (err) => notifications.show({ color: 'red', message: t(`errors.${getApiErrorCode(err)}`) }),
			onSettled: () => setBaseModalOpened(false),
		})
	}

	/** Renders the new order at once; a new first language opens the confirmation instead of saving. */
	const applyOrder = (languageIds: string[], movedId: string) => {
		// Renders the new order before the browser paints the row SortableJS was just put back at; otherwise it flashes at its old place.
		flushSync(() => setDropped({ from: data, ids: languageIds, movedId }))
		const newBase = data?.find((language) => language.id === languageIds[0])
		if (newBase && newBase.id !== currentBase?.id) {
			setBaseChange({ language: newBase, currentBase })
			setBaseModalOpened(true)
			return
		}
		saveOrder(languageIds, movedId)
	}

	const confirmBaseChange = () => {
		if (dropped && !reorder.isPending) {
			saveOrder(dropped.ids, dropped.movedId)
		}
	}

	const cancelBaseChange = () => {
		if (!reorder.isPending) {
			setBaseModalOpened(false)
			setDropped(null)
		}
	}

	const moveBy = (languageId: string, offset: number) => {
		const ids = languages?.map((language) => language.id) ?? []
		const from = ids.indexOf(languageId)
		const to = from + offset
		if (from === -1 || to < 0 || to >= ids.length) {
			return
		}
		ids.splice(from, 1)
		ids.splice(to, 0, languageId)
		applyOrder(ids, languageId)
	}

	const onSorted = useEffectEvent((oldIndex: number, newIndex: number) => {
		const ids = languages?.map((language) => language.id) ?? []
		const [moved] = ids.splice(oldIndex, 1)
		if (moved) {
			ids.splice(newIndex, 0, moved)
			applyOrder(ids, moved)
		}
	})

	const canReorder = reorderable && (data?.length ?? 0) > 1

	useEffect(() => {
		const body = bodyRef.current
		if (!body || !canReorder) {
			return
		}
		const sortable = Sortable.create(body, {
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

	const share = (part: number, total: number) => {
		const { percent, bound } = formatShare(part, total, i18n.language)
		return bound ? t(`dashboardPage.${bound}`, { percent }) : percent
	}

	const renderCoverage = (language: LanguageListItem, percent: string) => (
		<div className={classes.coverage}>
			<Progress
				value={language.keyCount === 0 ? 0 : (language.translatedCount / language.keyCount) * 100}
				size={6}
				radius='xl'
				className='flex-1'
				classNames={{ root: classes.track }}
				aria-label={t('languagesPage.table.coverageLabel', { name: languageName(language), percent })}
			/>
			<Text component='span' className={classes.percent}>
				{percent}
			</Text>
		</div>
	)

	const translatedOf = (language: LanguageListItem) =>
		t('languagesPage.table.translatedOfLong', { translated: language.translatedCount, total: language.keyCount })

	const stateRow = (content: ReactNode) => (
		<Table.Tr className={classes.tr}>
			<Table.Td colSpan={COLUMN_COUNT} className={`${classes.td} ${classes.state}`}>
				{content}
			</Table.Td>
		</Table.Tr>
	)

	const renderBody = () => {
		if (isPending) {
			return Array.from({ length: SKELETON_ROWS }, (_, index) => (
				<Table.Tr key={index} className={classes.tr}>
					<Table.Td colSpan={COLUMN_COUNT} className={classes.td}>
						<div className='flex items-center gap-3'>
							<Skeleton circle height={40} />
							<Skeleton height={12} width='30%' radius='sm' />
						</div>
					</Table.Td>
				</Table.Tr>
			))
		}
		if (isError) {
			return stateRow(
				<div className='flex flex-col items-center gap-1'>
					<Text size='sm' fw={600} c='var(--app-color-text-strong)'>
						{t('languagesPage.table.loadError')}
					</Text>
					<Text size='xs'>{t(`errors.${getApiErrorCode(error)}`)}</Text>
					<Button variant='default' mt='md' loading={isRefetching} onClick={() => void retry()}>
						{t('languagesPage.table.retry')}
					</Button>
				</div>,
			)
		}
		if (data.length === 0) {
			return stateRow(
				<div className='flex flex-col items-center gap-4'>
					<Text size='sm'>{t('languagesPage.table.empty')}</Text>
					{onAdd && (
						<Button leftSection={<Plus aria-hidden />} onClick={(event) => onAdd(event.currentTarget)}>
							{t('languagesPage.addButton')}
						</Button>
					)}
				</div>,
			)
		}
		return (languages ?? []).map((language) => {
			const percent = share(language.translatedCount, language.keyCount)
			return (
				<Table.Tr key={language.id} className={classes.tr}>
					<Table.Td className={classes.td}>
						<div className={`${classes.languageRow} flex items-center gap-3`}>
							{canReorder && (
								<Tooltip label={t('languagesPage.table.move')}>
									<ActionIcon
										variant='transparent'
										size={32}
										radius='md'
										aria-label={t('languagesPage.table.moveLabel', { name: languageName(language) })}
										aria-describedby={moveHintId}
										ref={(element) => {
											if (element) {
												gripRefs.current.set(language.id, element)
											} else {
												gripRefs.current.delete(language.id)
											}
										}}
										onBlur={(event) => {
											// A blur from the DOM move has no relatedTarget; only a real focus change ends the keyboard move.
											if (event.relatedTarget) {
												setKeyboardMovedId(null)
											}
										}}
										className={classes.grip}
										onKeyDown={(event) => gripKeyDown(event, language.id)}
									>
										<GripVertical aria-hidden />
									</ActionIcon>
								</Tooltip>
							)}
							<LanguageFlag code={language.flagCode} size='lg' />
							<div className='flex min-w-0 flex-1 flex-col'>
								<div className='flex flex-wrap items-center gap-x-5 gap-y-1'>
									<Link
										to='/projects/$projectSlug/translations'
										params={{ projectSlug }}
										search={translationsSearch(language)}
										className={`${classes.name} ${classes.nameLink}`}
									>
										{languageName(language)}
									</Link>
									{language.isBase && (
										<BaseLanguageHint>
											<Badge radius='xl' classNames={{ root: classes.badge, label: classes.badgeLabel }}>
												{t('languagesPage.table.base')}
											</Badge>
										</BaseLanguageHint>
									)}
								</div>
								<Text component='span' className={classes.meta}>
									{language.nativeName} · {language.tag}
								</Text>
								<div className={`${classes.phoneOnly} mt-2 flex-col gap-1`}>
									{renderCoverage(language, percent)}
									<Text component='span' className={classes.meta}>
										{translatedOf(language)}
									</Text>
								</div>
							</div>
						</div>
					</Table.Td>
					<Table.Td className={`${classes.td} ${classes.wideOnly}`}>
						<Text component='span' className={classes.count}>
							{t('languagesPage.table.translatedOf', { translated: language.translatedCount, total: language.keyCount })}
						</Text>
					</Table.Td>
					<Table.Td className={`${classes.td} ${classes.tabletUp}`}>
						{renderCoverage(language, percent)}
						<Text component='span' className={`${classes.meta} ${classes.narrowOnly}`}>
							{translatedOf(language)}
						</Text>
					</Table.Td>
					<Table.Td className={`${classes.td} ${classes.actionsCell}`}>
						<div className={classes.actions}>
							<RowAction
								icon={Translate}
								tooltip={t('languagesPage.table.open')}
								label={t('languagesPage.table.openLabel', { name: languageName(language) })}
								to='/projects/$projectSlug/translations'
								params={{ projectSlug }}
								search={translationsSearch(language)}
							/>
							{onDelete && (
								<RowAction
									icon={Trash}
									tooltip={t('languagesPage.table.delete')}
									label={t('languagesPage.table.deleteLabel', { name: languageName(language) })}
									danger
									disabled={language.isBase}
									onClick={(event) => onDelete(language, event.currentTarget)}
								/>
							)}
						</div>
					</Table.Td>
				</Table.Tr>
			)
		})
	}

	return (
		<div className={classes.card}>
			<Table ref={mergedRef} tabIndex={-1} aria-label={t('languagesPage.table.label')} aria-busy={isPending} withRowBorders={false}>
				<Table.Thead>
					<Table.Tr>
						<Table.Th className={classes.th}>{t('languagesPage.table.language')}</Table.Th>
						<Table.Th className={`${classes.th} ${classes.translatedColumn} ${classes.wideOnly}`}>{t('languagesPage.table.translated')}</Table.Th>
						<Table.Th className={`${classes.th} ${classes.coverageColumn} ${classes.tabletUp}`}>{t('languagesPage.table.coverage')}</Table.Th>
						<Table.Th className={`${classes.th} ${classes.actionsColumn}`}>
							<VisuallyHidden>{t('languagesPage.table.actionsColumn')}</VisuallyHidden>
						</Table.Th>
					</Table.Tr>
				</Table.Thead>
				<Table.Tbody ref={bodyRef}>{renderBody()}</Table.Tbody>
			</Table>
			<VisuallyHidden id={moveHintId}>{t('languagesPage.table.moveHint')}</VisuallyHidden>
			<VisuallyHidden role='status'>{announcement}</VisuallyHidden>
			<ChangeBaseLanguageModal
				opened={baseModalOpened}
				language={baseChange?.language ?? null}
				currentBase={baseChange?.currentBase ?? null}
				isPending={reorder.isPending}
				onConfirm={confirmBaseChange}
				onCancel={cancelBaseChange}
			/>
		</div>
	)
}

export default LanguagesTable
