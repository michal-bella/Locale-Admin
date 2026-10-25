import { Button, Skeleton, Table, Text, Tooltip, VisuallyHidden } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { Fragment, type PointerEvent as ReactPointerEvent, type ReactNode, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { type Language, placeholderReference, ROLE, type TranslationCell as TranslationCellData, type TranslationListItem } from '@locale/shared'

import { useMeQuery } from '@/api/auth/meQuery'
import getApiErrorCode from '@/api/getApiErrorCode'
import BaseLanguageHint from '@/components/BaseLanguageHint/BaseLanguageHint'
import EditKeyModal from '@/components/EditKeyModal/EditKeyModal'
import EditTranslationModal from '@/components/EditTranslationModal/EditTranslationModal'
import { Edit, Info, SwitchHorizontal, Upload } from '@/components/Icons'
import LanguageFlag from '@/components/LanguageFlag/LanguageFlag'
import RowAction from '@/components/RowAction/RowAction'
import TranslationCell from '@/components/TranslationCell/TranslationCell'
import TranslationStatusBadge from '@/components/TranslationStatusBadge/TranslationStatusBadge'
import TranslationValue from '@/components/TranslationValue/TranslationValue'
import { formatDateTime } from '@/lib/formatDate'
import { formatRelativeTime } from '@/lib/formatRelativeTime'

import classes from './TranslationsTable.module.css'
import { type TranslationsTableProps } from './types'

const SKELETON_ROWS = 5

const COLUMN_MAX_WIDTH = 800

// Like the warning icons: not focusable, so touch opens the hint and Tab still goes from cell to cell.
const TOOLTIP_EVENTS = { hover: true, focus: false, touch: true } as const

const EMPTY_CELL: TranslationCellData = { value: null, status: 'UNTRANSLATED', updatedAt: null, updatedBy: null }

/** `viaNext`: opened by Uložiť a ďalší while the modal stayed open. */
type Editing = { item: TranslationListItem; language: Language; viaNext?: boolean }

/**
 * Keys with their translations; every translation cell is a `TranslationCell` that opens `EditTranslationModal`. `EXTENDED` shows a column per language
 * (Excel-like, horizontal scroll, the key and status columns stick to the edges), `COMPACT` the source text and the target cell (Figma 3:147). With `layout`
 * `STACKED` either view puts its languages under each other in one column and the status badge into the key cell. With `showGroups`
 * a group header row starts every run of keys with the same `group` (also the first row of a page), so with the default sort the untranslated keys come first
 * and are grouped inside. `translationsOnly` hides the key and status columns (more room for the languages on a phone); the key stays in the
 * accessible name of every cell. An untranslated cell has a soft red background. An ADMIN or EDITOR gets an edit button next to every key that opens `EditKeyModal`.
 * With `item.diff` (every version but the first) an added key wears a „Nové“ badge and a changed cell a brand left border.
 */
const TranslationsTable = ({
	projectId,
	data,
	isPending,
	isError,
	error,
	onRetry,
	isRetrying,
	view,
	layout,
	languages,
	sourceLanguage,
	targetLanguage,
	onClearFilters,
	onImport,
	showGroups,
	translationsOnly = false,
	readOnly = false,
	openTranslationOf,
	previousVersionName,
	onSave,
}: TranslationsTableProps) => {
	const { t, i18n } = useTranslation()
	const { data: me } = useMeQuery()
	const isAdmin = me?.role === ROLE.ADMIN
	const canOpenKey = isAdmin || me?.role === ROLE.EDITOR
	const tableRef = useRef<HTMLTableElement>(null)
	const scrollRef = useRef<HTMLDivElement>(null)
	// Which sticky column has content scrolled under it: the key column once scrolled right, the status column until the right end.
	const [hiddenStart, setHiddenStart] = useState(false)
	const [hiddenEnd, setHiddenEnd] = useState(false)
	const updateScrollShadows = () => {
		const scroll = scrollRef.current
		if (scroll) {
			setHiddenStart(scroll.scrollLeft > 0)
			setHiddenEnd(scroll.scrollLeft + scroll.clientWidth < scroll.scrollWidth - 1)
		}
	}
	const [editOpened, editModal] = useDisclosure(false)
	const [editing, setEditing] = useState<TranslationListItem | null>(null)
	const [translationOpened, translationModal] = useDisclosure(false)
	const [editingTranslation, setEditingTranslation] = useState<Editing | null>(null)
	const [openedRequest, setOpenedRequest] = useState<string | undefined>(undefined)
	const [columnWidths, setColumnWidths] = useState<Record<string, number>>({})
	const [resizing, setResizing] = useState<string | null>(null)
	const defaultWidths = useRef<Record<string, number>>({})
	const baseLanguage = languages.find((language) => language.isBase)
	const isExtended = view === 'EXTENDED'
	const isStacked = layout === 'STACKED'
	const isColumns = isExtended && !isStacked
	const valueColumnCount = isStacked ? 1 : isExtended ? languages.length : 2
	const columnCount = valueColumnCount + (translationsOnly ? 0 : isStacked ? 1 : 2)
	const keyClass = `${classes.td} ${classes.keyCell} ${isColumns ? classes.stickyStart : ''}`
	const statusClass = `${classes.td} ${classes.statusCell} ${isColumns ? classes.stickyEnd : ''}`
	const tdClass = `${classes.td} ${isStacked ? classes.tdStacked : ''}`

	// Excel-like column resizing, only in the extended view (the compact one fills the card with two fixed columns, and a width measured
	// there would become the minimum here); the widths live only here, so a refresh brings the defaults back.
	// A column can only grow: the width it had before the first drag is its minimum, `COLUMN_MAX_WIDTH` its maximum (unless the minimum is wider).
	const startResize = (column: string, event: ReactPointerEvent<HTMLElement>) => {
		if (event.button !== 0) {
			return
		}
		event.preventDefault()
		const startX = event.clientX
		const startWidth = event.currentTarget.parentElement?.getBoundingClientRect().width ?? 0
		const minWidth = (defaultWidths.current[column] ??= startWidth)
		const move = (moveEvent: PointerEvent) => {
			setColumnWidths((widths) => ({ ...widths, [column]: Math.max(minWidth, Math.min(COLUMN_MAX_WIDTH, startWidth + moveEvent.clientX - startX)) }))
		}
		const stop = () => {
			window.removeEventListener('pointermove', move)
			window.removeEventListener('pointerup', stop)
			window.removeEventListener('pointercancel', stop)
			setResizing(null)
		}
		window.addEventListener('pointermove', move)
		window.addEventListener('pointerup', stop)
		window.addEventListener('pointercancel', stop)
		setResizing(column)
	}

	const columnStyle = (column: string) => {
		const width = columnWidths[column]
		return width === undefined ? undefined : { width, minWidth: width }
	}

	const resizeHandle = (column: string) => (
		<span aria-hidden data-resize-handle={column} className={classes.resizeHandle} onPointerDown={(event) => startResize(column, event)} />
	)

	const openEdit = (item: TranslationListItem) => {
		setEditing(item)
		editModal.open()
	}

	const openTranslation = (item: TranslationListItem, language: Language) => {
		setEditingTranslation({ item, language })
		translationModal.open()
	}

	// Set during render, not in an effect: the request opens the modal once, as soon as the (possibly still placeholder) list has the key.
	const openRequest = openTranslationOf && `${openTranslationOf.keyId}:${openTranslationOf.language.id}`
	if (openRequest !== openedRequest) {
		const requested = openTranslationOf && !readOnly ? data?.items.find((item) => item.keyId === openTranslationOf.keyId) : undefined
		if (!openTranslationOf || requested) {
			setOpenedRequest(openRequest)
		}
		if (requested && openTranslationOf) {
			openTranslation(requested, openTranslationOf.language)
		}
	}

	// Editable cells of the page in reading order: every language in the extended view, the target in the compact one.
	const editableLanguages = isExtended ? languages : targetLanguage ? [targetLanguage] : []
	const nextUntranslated = (() => {
		if (!editingTranslation || !data) {
			return undefined
		}
		const cells = data.items.flatMap((item) => editableLanguages.map((language) => ({ item, language })))
		const current = cells.findIndex(({ item, language }) => item.keyId === editingTranslation.item.keyId && language.id === editingTranslation.language.id)
		return cells.slice(current + 1).find(({ item, language }) => item.translations[language.id]?.status !== 'TRANSLATED')
	})()

	// A successful retry replaces the focused retry button with the rows.
	const retry = async () => {
		if (await onRetry()) {
			tableRef.current?.focus()
		}
	}

	// Zrušiť filtre disappears with the rows that replace it, so the focus moves to the table instead of the body.
	const clearFilters = () => {
		onClearFilters()
		tableRef.current?.focus()
	}

	const stateRow = (content: ReactNode) => (
		<Table.Tr>
			<Table.Td colSpan={columnCount} className={`${classes.td} ${classes.state}`}>
				{content}
			</Table.Td>
		</Table.Tr>
	)

	// What the API compares a value against (`placeholderReference`); undefined when the cell is not checked.
	const referenceFor = (item: TranslationListItem, language: Language): string | undefined => {
		if (!baseLanguage) {
			return undefined
		}
		const base = item.translations[baseLanguage.id]?.value ?? null
		return placeholderReference({ name: item.name, plural: item.plural !== null }, base, language.isBase) ?? undefined
	}

	const isChanged = (item: TranslationListItem, language: Language) => item.diff?.changedLanguageIds.includes(language.id) ?? false

	const translationCell = (item: TranslationListItem, language: Language) => (
		<TranslationCell
			cell={item.translations[language.id] ?? EMPTY_CELL}
			label={t('translationsPage.editor.label', { key: item.name, language: t(`languageNames.${language.tag}`) })}
			pluralTag={item.plural ? language.tag : undefined}
			reference={referenceFor(item, language)}
			changed={isChanged(item, language)}
			onClick={readOnly ? undefined : () => openTranslation(item, language)}
		/>
	)

	// The read-only source of the compact view gets the same marker as a cell when its value changed.
	const sourceValue = (item: TranslationListItem, language: Language | undefined, className: string | undefined) => {
		const changed = language !== undefined && isChanged(item, language)
		return (
			<Tooltip label={t('translationsPage.table.diffChangedTooltip')} disabled={!changed} events={TOOLTIP_EVENTS}>
				<span className={className}>
					{changed && (
						<>
							<VisuallyHidden>{t('translationsPage.table.diffChanged')}: </VisuallyHidden>
							<SwitchHorizontal aria-hidden className={classes.sourceChangedIcon} data-diff-changed />
						</>
					)}
					<TranslationValue
						value={(language && item.translations[language.id])?.value ?? null}
						pluralTag={item.plural ? language?.tag : undefined}
						reference={language && referenceFor(item, language)}
					/>
				</span>
			</Tooltip>
		)
	}

	const languageLabel = (language: Language) => (
		<span className={classes.languageHeader}>
			<LanguageFlag code={language.flagCode} size='sm' />
			{t(`languageNames.${language.tag}`)}
			{language.isBase && (
				<>
					{' '}
					<BaseLanguageHint>
						<span className={classes.baseBadge}>{t('translationsPage.table.base')}</span>
					</BaseLanguageHint>
				</>
			)}
		</span>
	)

	const stackedCell = (item: TranslationListItem, language: Language) => (
		<div key={language.id} className={classes.stackItem}>
			<span className={classes.stackLanguage}>{languageLabel(language)}</span>
			{translationCell(item, language)}
		</div>
	)

	const renderItem = (item: TranslationListItem, now: Date) => {
		const target = (targetLanguage && item.translations[targetLanguage.id]) ?? EMPTY_CELL
		const latestUpdatedAt = Object.values(item.translations).reduce<string | null>(
			(latest, cell) => (cell.updatedAt && (!latest || cell.updatedAt > latest) ? cell.updatedAt : latest),
			null,
		)
		// The compact view shows when the target changed, else (a target never written) the latest change in any language like the extended one.
		const updatedAt = isExtended ? latestUpdatedAt : (target.updatedAt ?? latestUpdatedAt)
		return (
			<Table.Tr key={item.keyId} data-status={item.status} className={classes.row}>
				{!translationsOnly && (
					<Table.Td className={`${keyClass} ${isStacked ? classes.tdStacked : ''}`}>
						<div className={classes.keyRow}>
							<Text component='span' className={classes.key}>
								{item.name}
							</Text>
							{item.diff?.added && (
								<span className={classes.diffBadge}>
									<span aria-hidden>{t('translationsPage.table.diffAdded')}</span>
									<VisuallyHidden>{t('translationsPage.table.diffAddedLabel')}</VisuallyHidden>
								</span>
							)}
							{item.description && (
								<Tooltip label={item.description} events={TOOLTIP_EVENTS} multiline w={260}>
									<span
										role='img'
										aria-label={t('translationsPage.table.description', { description: item.description })}
										className={classes.descriptionIcon}
									>
										<Info aria-hidden />
									</span>
								</Tooltip>
							)}
							{canOpenKey && (
								<span className={classes.editAction}>
									<RowAction
										icon={Edit}
										tooltip={t('translationsPage.table.edit')}
										label={t('translationsPage.table.editLabel', { key: item.name })}
										onClick={() => openEdit(item)}
									/>
								</span>
							)}
						</div>
						<span className={classes.meta}>
							<span>{item.group || t('translationsPage.table.noGroup')}</span>
							{updatedAt && (
								<>
									<span aria-hidden className={classes.metaDot} />
									<time dateTime={updatedAt} title={formatDateTime(updatedAt, i18n.language)}>
										{formatRelativeTime(updatedAt, i18n.language, now, 'short')}
									</time>
								</>
							)}
						</span>
						{isStacked && (
							<span className={classes.stackedStatus}>
								<TranslationStatusBadge status={item.status} />
							</span>
						)}
					</Table.Td>
				)}
				{isStacked ? (
					<Table.Td className={`${tdClass} ${classes.value}`}>
						<div className={classes.stack}>
							{isExtended ? (
								languages.map((language) => stackedCell(item, language))
							) : (
								<>
									{sourceLanguage && (
										<div className={classes.stackItem}>
											<span className={classes.stackLanguage}>{languageLabel(sourceLanguage)}</span>
											{sourceValue(item, sourceLanguage, `${classes.sourceValue} ${classes.stackSource}`)}
										</div>
									)}
									{targetLanguage && stackedCell(item, targetLanguage)}
								</>
							)}
						</div>
					</Table.Td>
				) : isExtended ? (
					languages.map((language) => (
						<Table.Td key={language.id} className={`${classes.td} ${classes.value}`}>
							{translationCell(item, language)}
						</Table.Td>
					))
				) : (
					<>
						<Table.Td className={`${classes.td} ${classes.value}`}>{sourceValue(item, sourceLanguage, classes.sourceValue)}</Table.Td>
						<Table.Td className={`${classes.td} ${classes.value}`}>{targetLanguage && translationCell(item, targetLanguage)}</Table.Td>
					</>
				)}
				{!isStacked && !translationsOnly && (
					<Table.Td className={statusClass}>
						<TranslationStatusBadge status={item.status} collapsible />
					</Table.Td>
				)}
			</Table.Tr>
		)
	}

	const renderBody = () => {
		if (isPending) {
			return Array.from({ length: SKELETON_ROWS }, (_, index) => (
				<Table.Tr key={index}>
					{!translationsOnly && (
						<Table.Td className={`${keyClass} ${isStacked ? classes.tdStacked : ''}`}>
							<Skeleton height={12} width='60%' radius='sm' />
							<Skeleton height={8} width='30%' radius='sm' mt='xs' />
						</Table.Td>
					)}
					{Array.from({ length: valueColumnCount }, (_, column) => (
						<Table.Td key={column} className={tdClass}>
							<Skeleton height={12} width='80%' radius='sm' />
						</Table.Td>
					))}
					{!isStacked && !translationsOnly && (
						<Table.Td className={statusClass}>
							<Skeleton height={20} width={80} radius='xl' />
						</Table.Td>
					)}
				</Table.Tr>
			))
		}
		if (isError) {
			return stateRow(
				<div role='alert' className='flex flex-col items-center gap-1'>
					<Text size='sm' fw={600} c='var(--app-color-text-strong)'>
						{t('translationsPage.table.loadError')}
					</Text>
					<Text size='xs'>{t(`errors.${getApiErrorCode(error)}`)}</Text>
					<Button variant='default' mt='md' loading={isRetrying} onClick={() => void retry()}>
						{t('translationsPage.table.retry')}
					</Button>
				</div>,
			)
		}
		if (!data || data.stats.totalKeys === 0) {
			return stateRow(
				<div className='flex flex-col items-center gap-4'>
					<Text size='sm'>{isAdmin ? t('translationsPage.table.empty') : t('translationsPage.table.emptyEditor')}</Text>
					{isAdmin && (
						<Button variant='default' leftSection={<Upload aria-hidden />} onClick={onImport}>
							{t('translationsPage.importButton')}
						</Button>
					)}
				</div>,
			)
		}
		if (data.items.length === 0) {
			return stateRow(
				<div className='flex flex-col items-center gap-4'>
					<Text size='sm'>{t('translationsPage.table.noResults')}</Text>
					<Button variant='default' onClick={clearFilters}>
						{t('translationsPage.table.clearFilters')}
					</Button>
				</div>,
			)
		}
		const now = new Date()
		return data.items.map((item, index) => (
			<Fragment key={item.keyId}>
				{showGroups && item.group !== data.items[index - 1]?.group && (
					<Table.Tr data-group-header className={classes.groupRow}>
						<Table.Th colSpan={columnCount} scope='rowgroup' className={classes.groupCell}>
							{/* Stays in view while the extended table scrolls horizontally. */}
							<span className={classes.groupLabel}>{item.group || t('translationsPage.table.noGroup')}</span>
						</Table.Th>
					</Table.Tr>
				)}
				{renderItem(item, now)}
			</Fragment>
		))
	}

	// The table width changes with the data, the column widths and the window, none of which fires a scroll event.
	useEffect(() => {
		const scroll = scrollRef.current
		const table = tableRef.current
		if (!scroll || !table) {
			return
		}
		updateScrollShadows()
		const observer = new ResizeObserver(updateScrollShadows)
		observer.observe(scroll)
		observer.observe(table)
		return () => observer.disconnect()
	}, [])

	return (
		<div
			ref={scrollRef}
			className={`${classes.scroll} ${isColumns && !translationsOnly ? classes.scrollExtended : ''}`}
			data-resizing={resizing ?? undefined}
			data-hidden-start={hiddenStart || undefined}
			data-hidden-end={hiddenEnd || undefined}
			onScroll={updateScrollShadows}
		>
			<Table
				ref={tableRef}
				tabIndex={-1}
				aria-label={t('translationsPage.table.label')}
				aria-busy={isPending}
				withRowBorders={false}
				className={`${classes.table} ${isColumns ? classes.extended : ''} ${isStacked ? '' : classes.dense}`}
				data-view={view}
				data-layout={isStacked ? 'STACKED' : undefined}
			>
				<Table.Thead>
					<Table.Tr>
						{!translationsOnly && (
							<Table.Th
								className={`${classes.th} ${isColumns ? `${classes.keyColumnExtended} ${classes.stickyStart}` : classes.keyColumn} ${isStacked ? classes.thStacked : ''}`}
							>
								{t('translationsPage.table.key')}
							</Table.Th>
						)}
						{isStacked ? (
							<Table.Th className={`${classes.th} ${classes.thStacked}`}>{t('translationsPage.table.translations')}</Table.Th>
						) : isExtended ? (
							languages.map((language) => (
								<Table.Th
									key={language.id}
									className={`${classes.th} ${classes.languageColumn} ${classes.languageTh} ${classes.resizable}`}
									style={columnStyle(language.id)}
								>
									{languageLabel(language)}
									{resizeHandle(language.id)}
								</Table.Th>
							))
						) : (
							<>
								{[sourceLanguage, targetLanguage].map((language, index) => (
									<Table.Th key={language?.id ?? index} className={`${classes.th} ${classes.languageTh}`}>
										{language && languageLabel(language)}
									</Table.Th>
								))}
							</>
						)}
						{!isStacked && !translationsOnly && (
							<Table.Th className={`${classes.th} ${classes.statusColumn} ${classes.statusCell} ${isColumns ? classes.stickyEnd : ''}`}>
								{t('translationsPage.table.status')}
							</Table.Th>
						)}
					</Table.Tr>
				</Table.Thead>
				<Table.Tbody>{renderBody()}</Table.Tbody>
			</Table>
			{canOpenKey && (
				<EditKeyModal
					projectId={projectId}
					item={editing}
					opened={editOpened}
					onClose={editModal.close}
					canEditKey={isAdmin}
					canEditDescription={isAdmin || !readOnly}
				/>
			)}
			{!readOnly && (
				<EditTranslationModal
					item={editingTranslation?.item ?? null}
					language={editingTranslation?.language ?? null}
					baseLanguage={baseLanguage}
					opened={translationOpened}
					onClose={translationModal.close}
					onSave={onSave}
					onNext={nextUntranslated && (() => setEditingTranslation({ ...nextUntranslated, viaNext: true }))}
					focusOnSwitch={editingTranslation?.viaNext}
					previousVersionName={previousVersionName}
				/>
			)}
		</div>
	)
}

export default TranslationsTable
