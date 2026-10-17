import { ActionIcon, Badge, Button, Menu, Skeleton, Table, Text } from '@mantine/core'
import { type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import getApiErrorCode from '@/api/getApiErrorCode'
import { useLanguagesQuery } from '@/api/languages/languagesQuery'
import { DotsHorizontal, Plus } from '@/components/Icons'
import LanguageFlag from '@/components/LanguageFlag/LanguageFlag'

import classes from './LanguagesTable.module.css'
import { type LanguagesTableProps } from './types'

const SKELETON_ROWS = 3

/** Language list in a card (Figma 3:812) without the Preložené, Na kontrolu and Pokrytie columns. */
const LanguagesTable = ({ onAdd, onEdit, onDelete }: LanguagesTableProps) => {
	const { t } = useTranslation()
	const { data, isPending, isError, error, refetch, isRefetching } = useLanguagesQuery()

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
					<Button variant='default' mt='md' loading={isRefetching} onClick={() => void refetch()}>
						{t('languagesPage.table.retry')}
					</Button>
				</div>,
			)
		}
		if (data.length === 0) {
			return stateRow(
				<div className='flex flex-col items-center gap-4'>
					<Text size='sm'>{t('languagesPage.table.empty')}</Text>
					<Button leftSection={<Plus aria-hidden />} onClick={onAdd}>
						{t('languagesPage.addButton')}
					</Button>
				</div>,
			)
		}
		return data.map((language) => (
			<Table.Tr key={language.id} className={classes.tr}>
				<Table.Td className={classes.td}>
					<div className='flex items-center gap-3'>
						<LanguageFlag code={language.flagCode} variant='round' />
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
					<Menu position='bottom-end' width={180} radius='lg' shadow='md'>
						<Menu.Target>
							<ActionIcon
								variant='transparent'
								size={34}
								radius='sm'
								aria-label={t('languagesPage.table.actions', { name: language.englishName })}
								className={classes.menuButton}
							>
								<DotsHorizontal aria-hidden />
							</ActionIcon>
						</Menu.Target>
						<Menu.Dropdown>
							<Menu.Item onClick={() => onEdit(language)}>{t('languagesPage.table.edit')}</Menu.Item>
							<Menu.Item color='red' disabled={language.isBase} onClick={() => onDelete(language)}>
								{t('languagesPage.table.delete')}
							</Menu.Item>
						</Menu.Dropdown>
					</Menu>
				</Table.Td>
			</Table.Tr>
		))
	}

	return (
		<div className={classes.card}>
			<Table aria-label={t('languagesPage.table.label')} aria-busy={isPending} withRowBorders={false}>
				<Table.Thead>
					<Table.Tr>
						<Table.Th className={classes.th}>{t('languagesPage.table.language')}</Table.Th>
						<Table.Th className={`${classes.th} ${classes.actionsColumn}`} />
					</Table.Tr>
				</Table.Thead>
				<Table.Tbody>{renderBody()}</Table.Tbody>
			</Table>
		</div>
	)
}

export default LanguagesTable
