import { Badge, Button, Skeleton, Table, Text } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { Fragment, type ReactNode, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { type Language, ROLE, type TranslationCell as TranslationCellData, type TranslationListItem } from '@locale/shared'

import { useMeQuery } from '@/api/auth/meQuery'
import getApiErrorCode from '@/api/getApiErrorCode'
import EditKeyModal from '@/components/EditKeyModal/EditKeyModal'
import EditTranslationModal from '@/components/EditTranslationModal/EditTranslationModal'
import { Edit, Upload } from '@/components/Icons'
import RowAction from '@/components/RowAction/RowAction'
import TranslationCell from '@/components/TranslationCell/TranslationCell'
import TranslationValue from '@/components/TranslationValue/TranslationValue'
import { formatDateTime } from '@/lib/formatDate'
import { formatRelativeTime } from '@/lib/formatRelativeTime'

import classes from './TranslationsTable.module.css'
import { type TranslationsTableProps } from './types'

const SKELETON_ROWS = 5

const COLUMNS = 4

const EMPTY_CELL: TranslationCellData = { value: null, status: 'UNTRANSLATED', updatedAt: null }

type Editing = { item: TranslationListItem; language: Language }

/**
 * Keys with the source and target text (Figma 3:147); the target cell is a `TranslationCell` that opens `EditTranslationModal`. With `showGroups` a group header
 * row starts every run of keys with the same `group` (also the first row of a page), so with the default sort the untranslated keys come first and are grouped
 * inside. An untranslated cell has a soft red background. A global ADMIN gets an edit button next to every key that opens `EditKeyModal`.
 */
const TranslationsTable = ({
	projectId,
	data,
	isPending,
	isError,
	error,
	onRetry,
	isRetrying,
	languages,
	sourceLanguage,
	targetLanguage,
	onClearFilters,
	onImport,
	showGroups,
	onSave,
}: TranslationsTableProps) => {
	const { t, i18n } = useTranslation()
	const { data: me } = useMeQuery()
	const isAdmin = me?.role === ROLE.ADMIN
	const tableRef = useRef<HTMLTableElement>(null)
	const [editOpened, editModal] = useDisclosure(false)
	const [editing, setEditing] = useState<TranslationListItem | null>(null)
	const [translationOpened, translationModal] = useDisclosure(false)
	const [editingTranslation, setEditingTranslation] = useState<Editing | null>(null)
	const baseLanguage = languages.find((language) => language.isBase)

	const openEdit = (item: TranslationListItem) => {
		setEditing(item)
		editModal.open()
	}

	const openTranslation = (item: TranslationListItem, language: Language) => {
		setEditingTranslation({ item, language })
		translationModal.open()
	}

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
			<Table.Td colSpan={COLUMNS} className={`${classes.td} ${classes.state}`}>
				{content}
			</Table.Td>
		</Table.Tr>
	)

	const renderItem = (item: TranslationListItem, now: Date) => {
		const source = (sourceLanguage && item.translations[sourceLanguage.id]) ?? EMPTY_CELL
		const target = (targetLanguage && item.translations[targetLanguage.id]) ?? EMPTY_CELL
		return (
			<Table.Tr key={item.keyId} data-status={item.status} className={classes.row}>
				<Table.Td className={classes.td}>
					<div className={classes.keyRow}>
						<Text component='span' className={classes.key}>
							{item.name}
						</Text>
						{isAdmin && (
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
					{item.description && (
						<span className={classes.description} title={item.description}>
							{item.description}
						</span>
					)}
					<span className={classes.meta}>
						<span>{item.group || t('translationsPage.table.noGroup')}</span>
						{target.updatedAt && (
							<>
								<span aria-hidden className={classes.metaDot} />
								<time dateTime={target.updatedAt} title={formatDateTime(target.updatedAt, i18n.language)}>
									{formatRelativeTime(target.updatedAt, i18n.language, now, 'short')}
								</time>
							</>
						)}
					</span>
				</Table.Td>
				<Table.Td className={`${classes.td} ${classes.value}`}>
					<TranslationValue value={source.value} pluralTag={item.plural ? sourceLanguage?.tag : undefined} />
				</Table.Td>
				<Table.Td className={`${classes.td} ${classes.value}`}>
					{targetLanguage && (
						<TranslationCell
							cell={target}
							label={t('translationsPage.editor.label', { key: item.name, language: targetLanguage.nativeName })}
							pluralTag={item.plural ? targetLanguage.tag : undefined}
							onClick={() => openTranslation(item, targetLanguage)}
						/>
					)}
				</Table.Td>
				<Table.Td className={`${classes.td} ${classes.statusCell}`}>
					<Badge
						variant='light'
						color={item.status === 'TRANSLATED' ? 'teal' : 'red'}
						radius='xl'
						tt='none'
						leftSection={<span aria-hidden className={classes.statusDot} />}
						className={classes.status}
					>
						{t(`translationsPage.status.${item.status}`)}
					</Badge>
				</Table.Td>
			</Table.Tr>
		)
	}

	const renderBody = () => {
		if (isPending) {
			return Array.from({ length: SKELETON_ROWS }, (_, index) => (
				<Table.Tr key={index}>
					<Table.Td className={classes.td}>
						<Skeleton height={12} width='60%' radius='sm' />
						<Skeleton height={8} width='30%' radius='sm' mt='xs' />
					</Table.Td>
					<Table.Td className={classes.td}>
						<Skeleton height={12} width='80%' radius='sm' />
					</Table.Td>
					<Table.Td className={classes.td}>
						<Skeleton height={12} width='80%' radius='sm' />
					</Table.Td>
					<Table.Td className={classes.td}>
						<Skeleton height={20} width={80} radius='xl' />
					</Table.Td>
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
					<Text size='sm'>{t('translationsPage.table.empty')}</Text>
					<Button variant='default' leftSection={<Upload aria-hidden />} onClick={onImport}>
						{t('translationsPage.importButton')}
					</Button>
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
						<Table.Th colSpan={COLUMNS} scope='rowgroup' className={classes.groupCell}>
							{item.group || t('translationsPage.table.noGroup')}
						</Table.Th>
					</Table.Tr>
				)}
				{renderItem(item, now)}
			</Fragment>
		))
	}

	return (
		<div className={classes.scroll}>
			<Table
				ref={tableRef}
				tabIndex={-1}
				aria-label={t('translationsPage.table.label')}
				aria-busy={isPending}
				withRowBorders={false}
				className={classes.table}
			>
				<Table.Thead>
					<Table.Tr>
						<Table.Th className={`${classes.th} ${classes.keyColumn}`}>{t('translationsPage.table.key')}</Table.Th>
						<Table.Th className={classes.th}>{sourceLanguage?.nativeName}</Table.Th>
						<Table.Th className={classes.th}>{targetLanguage?.nativeName}</Table.Th>
						<Table.Th className={`${classes.th} ${classes.statusColumn} ${classes.statusCell}`}>{t('translationsPage.table.status')}</Table.Th>
					</Table.Tr>
				</Table.Thead>
				<Table.Tbody>{renderBody()}</Table.Tbody>
			</Table>
			{isAdmin && <EditKeyModal projectId={projectId} item={editing} opened={editOpened} onClose={editModal.close} />}
			<EditTranslationModal
				item={editingTranslation?.item ?? null}
				language={editingTranslation?.language ?? null}
				baseLanguage={baseLanguage}
				opened={translationOpened}
				onClose={translationModal.close}
				onSave={onSave}
			/>
		</div>
	)
}

export default TranslationsTable
