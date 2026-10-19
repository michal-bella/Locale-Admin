import { Badge, Button, Skeleton, Table, Text } from '@mantine/core'
import { Fragment, type ReactNode, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { type TranslationListItem } from '@locale/shared'

import getApiErrorCode from '@/api/getApiErrorCode'
import { Upload } from '@/components/Icons'
import TranslationEditor from '@/components/TranslationEditor/TranslationEditor'
import TranslationText from '@/components/TranslationText/TranslationText'
import { formatDateTime } from '@/lib/formatDate'
import { formatRelativeTime } from '@/lib/formatRelativeTime'

import classes from './TranslationsTable.module.css'
import { type TranslationsTableProps } from './types'

const SKELETON_ROWS = 5

const COLUMNS = 4

const Value = ({ value }: { value: string | null }) => {
	const { t } = useTranslation()
	return value === null ? (
		<Text component='span' className={classes.placeholder}>
			{t('translationsPage.table.emptyValue')}
		</Text>
	) : (
		<TranslationText value={value} />
	)
}

/**
 * Keys with the source and target text (Figma 3:147); the target cell is a `TranslationEditor`. With `showGroups` a group header row starts every run of keys
 * with the same `group` (also the first row of a page), so with the default sort the untranslated keys come first and are grouped inside. Untranslated rows have a soft red background.
 */
const TranslationsTable = ({
	data,
	isPending,
	isError,
	error,
	onRetry,
	isRetrying,
	sourceLanguage,
	targetLanguage,
	onClearFilters,
	onImport,
	showGroups,
	onSave,
}: TranslationsTableProps) => {
	const { t, i18n } = useTranslation()
	const tableRef = useRef<HTMLTableElement>(null)

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

	const renderItem = (item: TranslationListItem, now: Date) => (
		<Table.Tr key={item.keyId} data-status={item.target.status} className={classes.row}>
			<Table.Td className={classes.td}>
				<Text component='span' className={classes.key}>
					{item.name}
				</Text>
				<span className={classes.meta}>
					<span>{item.group || t('translationsPage.table.noGroup')}</span>
					{item.target.updatedAt && (
						<>
							<span aria-hidden className={classes.metaDot} />
							<time dateTime={item.target.updatedAt} title={formatDateTime(item.target.updatedAt, i18n.language)}>
								{formatRelativeTime(item.target.updatedAt, i18n.language, now, 'short')}
							</time>
						</>
					)}
				</span>
			</Table.Td>
			<Table.Td className={`${classes.td} ${classes.value}`}>
				<Value value={item.source.value} />
			</Table.Td>
			<Table.Td className={`${classes.td} ${classes.value}`}>
				<TranslationEditor
					value={item.target.value}
					label={t('translationsPage.editor.label', { key: item.name, language: targetLanguage?.nativeName ?? '' })}
					onSave={(value) => onSave(item.keyId, value)}
				>
					<Value value={item.target.value} />
				</TranslationEditor>
			</Table.Td>
			<Table.Td className={`${classes.td} ${classes.statusCell}`}>
				<Badge
					variant='light'
					color={item.target.status === 'TRANSLATED' ? 'teal' : 'red'}
					radius='xl'
					tt='none'
					leftSection={<span aria-hidden className={classes.statusDot} />}
					className={classes.status}
				>
					{t(`translationsPage.status.${item.target.status}`)}
				</Badge>
			</Table.Td>
		</Table.Tr>
	)

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
		</div>
	)
}

export default TranslationsTable
