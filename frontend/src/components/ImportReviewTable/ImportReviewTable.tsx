import { Button, Select, Table, Text } from '@mantine/core'
import { Fragment, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { type ImportIssue, type ImportPreviewColumn } from '@locale/shared'

import { AlertTriangle, ChevronDown } from '@/components/Icons'
import ImportIssueList from '@/components/ImportIssueList/ImportIssueList'

import classes from './ImportReviewTable.module.css'
import { type ImportReviewTableProps } from './types'

const SKIP_VALUE = '__skip__'

const COLUMN_COUNT = 6

/** Warnings shown in the expanded row of one column; the count in the cell is the full `stats.warnings`. */
const COLUMN_WARNINGS_MAX = 20

const COLUMN_WARNING_CODES = new Set<ImportIssue['code']>(['PLACEHOLDER_MISMATCH', 'BASE_LANGUAGE_UNTRANSLATED'])

/** Language columns of the file (step 2 of the import, no Figma): which project language each column goes to and what the import would change. */
const ImportReviewTable = ({ preview, languages, mapping, onChange, onAddLanguage, addingTag, disabled }: ImportReviewTableProps) => {
	const { t } = useTranslation()
	const [expandedColumn, setExpandedColumn] = useState<number | null>(null)
	const warningsId = useId()

	const chosenIds = new Set(Object.values(mapping).filter((choice): choice is string => typeof choice === 'string'))

	const languageOptions = (column: ImportPreviewColumn) => [
		...languages.map((language) => ({
			value: language.id,
			label: `${language.englishName} (${language.tag})`,
			disabled: chosenIds.has(language.id) && mapping[column.columnIndex] !== language.id,
		})),
		{ value: SKIP_VALUE, label: t('importModal.review.skip') },
	]

	const renderChanges = (column: ImportPreviewColumn) => {
		const changes = preview.changes.find((item) => item.columnIndex === column.columnIndex)
		const keepsPreviewLanguage = column.match === 'PROJECT' && mapping[column.columnIndex] === column.languageId
		return changes && keepsPreviewLanguage ? `${changes.new} / ${changes.changed}` : '—'
	}

	const renderLanguageHint = (column: ImportPreviewColumn) => {
		if (column.match === 'PROJECT' || mapping[column.columnIndex] !== undefined) {
			return null
		}
		return (
			<div className='flex flex-wrap items-center gap-x-3 gap-y-1'>
				<Text component='span' size='xs' fw={600} className={classes.hint}>
					{column.match === 'CATALOG'
						? t('importModal.review.notInProject', { tag: column.tag })
						: t('importModal.review.unknownLanguage', { tag: column.tag })}
				</Text>
				<span className='flex items-center gap-1'>
					{column.match === 'CATALOG' && (
						<Button
							size='compact-xs'
							variant='subtle'
							loading={addingTag === column.tag}
							disabled={disabled && addingTag !== column.tag}
							aria-label={t('importModal.review.addLanguageLabel', { tag: column.tag })}
							onClick={() => onAddLanguage(column.tag)}
						>
							{t('importModal.review.addLanguage')}
						</Button>
					)}
					<Button
						size='compact-xs'
						variant='subtle'
						color='gray'
						disabled={disabled}
						aria-label={t('importModal.review.skipColumnLabel', { tag: column.tag })}
						onClick={() => onChange(column.columnIndex, null)}
					>
						{t('importModal.review.skip')}
					</Button>
				</span>
			</div>
		)
	}

	const renderWarnings = (column: ImportPreviewColumn) => {
		if (column.stats.warnings === 0) {
			return <Text size='sm'>0</Text>
		}
		const expanded = expandedColumn === column.columnIndex
		return (
			<Button
				size='compact-sm'
				variant='subtle'
				className={classes.warningButton}
				leftSection={<AlertTriangle aria-hidden />}
				rightSection={<ChevronDown aria-hidden width={12} height={12} data-expanded={expanded || undefined} className={classes.chevron} />}
				aria-expanded={expanded}
				aria-controls={expanded ? `${warningsId}-${column.columnIndex}` : undefined}
				aria-label={t('importModal.review.warningsButton', { count: column.stats.warnings, tag: column.tag })}
				onClick={() => setExpandedColumn(expanded ? null : column.columnIndex)}
			>
				{column.stats.warnings}
			</Button>
		)
	}

	return (
		<div className={classes.scroll}>
			<Table aria-label={t('importModal.review.table.label')} withRowBorders={false} className={classes.table}>
				<Table.Thead>
					<Table.Tr>
						<Table.Th className={`${classes.th} ${classes.languageColumn}`}>{t('importModal.review.table.language')}</Table.Th>
						<Table.Th className={classes.th}>{t('importModal.review.table.column')}</Table.Th>
						<Table.Th className={`${classes.th} ${classes.number}`}>{t('importModal.review.table.translations')}</Table.Th>
						<Table.Th className={`${classes.th} ${classes.number}`}>{t('importModal.review.table.untranslated')}</Table.Th>
						<Table.Th className={`${classes.th} ${classes.number}`}>{t('importModal.review.table.warnings')}</Table.Th>
						<Table.Th className={`${classes.th} ${classes.number}`}>{t('importModal.review.table.changes')}</Table.Th>
					</Table.Tr>
				</Table.Thead>
				<Table.Tbody>
					{preview.columns.map((column) => {
						const choice = mapping[column.columnIndex]
						const undecided = choice === undefined && column.match !== 'PROJECT'
						const columnWarnings = preview.warnings.filter((issue) => issue.column === column.columnIndex && COLUMN_WARNING_CODES.has(issue.code))
						return (
							<Fragment key={column.columnIndex}>
								<Table.Tr className={classes.tr} data-undecided={undecided || undefined}>
									<Table.Td className={classes.td}>
										<div className='flex flex-col gap-2'>
											<Select
												aria-label={t('importModal.review.languageSelect', { tag: column.tag })}
												placeholder={t('importModal.review.languagePlaceholder')}
												data={languageOptions(column)}
												value={choice === undefined ? null : (choice ?? SKIP_VALUE)}
												onChange={(value) => {
													if (value !== null) {
														onChange(column.columnIndex, value === SKIP_VALUE ? null : value)
													}
												}}
												allowDeselect={false}
												disabled={disabled}
												rightSection={<ChevronDown aria-hidden />}
												rightSectionPointerEvents='none'
												comboboxProps={{ withinPortal: true }}
											/>
											{renderLanguageHint(column)}
										</div>
									</Table.Td>
									<Table.Td className={classes.td}>
										<div className='flex flex-col'>
											<code className={classes.tag}>{column.tag}</code>
											<Text component='span' size='xs'>
												{t('importModal.review.columnIndex', { index: column.columnIndex })}
											</Text>
										</div>
									</Table.Td>
									<Table.Td className={`${classes.td} ${classes.number}`}>{column.stats.translations}</Table.Td>
									<Table.Td className={`${classes.td} ${classes.number}`}>{column.stats.untranslated}</Table.Td>
									<Table.Td className={`${classes.td} ${classes.number}`}>{renderWarnings(column)}</Table.Td>
									<Table.Td className={`${classes.td} ${classes.number}`}>{renderChanges(column)}</Table.Td>
								</Table.Tr>
								{expandedColumn === column.columnIndex && (
									<Table.Tr className={classes.tr}>
										<Table.Td
											id={`${warningsId}-${column.columnIndex}`}
											colSpan={COLUMN_COUNT}
											className={`${classes.td} ${classes.expanded}`}
										>
											<ImportIssueList
												title={t('importModal.review.columnWarningsTitle', { tag: column.tag })}
												issues={columnWarnings.slice(0, COLUMN_WARNINGS_MAX)}
												total={column.stats.warnings}
												tone='warning'
											/>
										</Table.Td>
									</Table.Tr>
								)}
							</Fragment>
						)
					})}
				</Table.Tbody>
			</Table>
		</div>
	)
}

export default ImportReviewTable
