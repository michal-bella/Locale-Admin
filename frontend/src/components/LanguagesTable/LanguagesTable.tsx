import { Badge, Button, Skeleton, Table, Text, VisuallyHidden } from '@mantine/core'
import { useMergedRef } from '@mantine/hooks'
import { type ReactNode, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import getApiErrorCode from '@/api/getApiErrorCode'
import { useProjectLanguagesQuery } from '@/api/projectLanguages/projectLanguagesQuery'
import { Plus, Trash } from '@/components/Icons'
import LanguageFlag from '@/components/LanguageFlag/LanguageFlag'
import RowAction from '@/components/RowAction/RowAction'

import classes from './LanguagesTable.module.css'
import { type LanguagesTableProps } from './types'

const SKELETON_ROWS = 3

/** Languages of a project in a card (Figma 3:812) without the Preložené, Na kontrolu and Pokrytie columns. The base language cannot be removed. */
const LanguagesTable = ({ projectId, onAdd, onDelete, ref }: LanguagesTableProps) => {
	const { t } = useTranslation()
	const { data, isPending, isError, error, refetch, isRefetching } = useProjectLanguagesQuery(projectId)
	const tableRef = useRef<HTMLTableElement>(null)
	const mergedRef = useMergedRef(tableRef, ref)

	// A successful retry replaces the focused retry button with the rows.
	const retry = async () => {
		const { isSuccess } = await refetch()
		if (isSuccess) {
			tableRef.current?.focus()
		}
	}

	const stateRow = (content: ReactNode) => (
		<Table.Tr className={classes.tr}>
			<Table.Td colSpan={2} className={`${classes.td} ${classes.state}`}>
				{content}
			</Table.Td>
		</Table.Tr>
	)

	const renderBody = () => {
		if (isPending) {
			return Array.from({ length: SKELETON_ROWS }, (_, index) => (
				<Table.Tr key={index} className={classes.tr}>
					<Table.Td colSpan={2} className={classes.td}>
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
					<Button leftSection={<Plus aria-hidden />} onClick={(event) => onAdd(event.currentTarget)}>
						{t('languagesPage.addButton')}
					</Button>
				</div>,
			)
		}
		return data.map((language) => (
			<Table.Tr key={language.id} className={classes.tr}>
				<Table.Td className={classes.td}>
					<div className='flex items-center gap-3'>
						<LanguageFlag code={language.flagCode} size='lg' />
						<div className='flex flex-col'>
							<Text size='sm' fw={600} c='var(--app-color-text-strong)' className={classes.name}>
								{language.englishName}
							</Text>
							<Text component='span' className={classes.meta}>
								{language.nativeName} · {language.tag}
							</Text>
						</div>
						{language.isBase && (
							<Badge radius='xl' className={`${classes.badge} ml-2`}>
								{t('languagesPage.table.base')}
							</Badge>
						)}
					</div>
				</Table.Td>
				<Table.Td className={`${classes.td} ${classes.actionsCell}`}>
					<RowAction
						icon={Trash}
						tooltip={t('languagesPage.table.delete')}
						label={t('languagesPage.table.deleteLabel', { name: language.englishName })}
						danger
						disabled={language.isBase}
						onClick={(event) => onDelete(language, event.currentTarget)}
					/>
				</Table.Td>
			</Table.Tr>
		))
	}

	return (
		<div className={classes.card}>
			<Table ref={mergedRef} tabIndex={-1} aria-label={t('languagesPage.table.label')} aria-busy={isPending} withRowBorders={false}>
				<Table.Thead>
					<Table.Tr>
						<Table.Th className={classes.th}>{t('languagesPage.table.language')}</Table.Th>
						<Table.Th className={`${classes.th} ${classes.actionsColumn}`}>
							<VisuallyHidden>{t('languagesPage.table.actionsColumn')}</VisuallyHidden>
						</Table.Th>
					</Table.Tr>
				</Table.Thead>
				<Table.Tbody>{renderBody()}</Table.Tbody>
			</Table>
		</div>
	)
}

export default LanguagesTable
