import { Avatar, Button, Skeleton, Table, Text } from '@mantine/core'
import { type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { getInitials } from '@locale/shared'

import { useAdminUsersQuery } from '@/api/adminUsers/adminUsersQuery'
import getApiErrorCode from '@/api/getApiErrorCode'
import { formatDate } from '@/lib/formatDate'

import classes from './UsersTable.module.css'

const SKELETON_ROWS = 3

/** Admin user list in a card (Figma 28:2) with loading, empty and error states. */
const UsersTable = () => {
	const { t, i18n } = useTranslation()
	const { data, isPending, isError, error, refetch, isRefetching } = useAdminUsersQuery()

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
					<Table.Td className={classes.td}>
						<div className='flex items-center gap-3'>
							<Skeleton circle height={32} />
							<Skeleton height={12} width='40%' radius='sm' />
						</div>
					</Table.Td>
					<Table.Td className={classes.td}>
						<Skeleton height={12} width='60%' radius='sm' />
					</Table.Td>
				</Table.Tr>
			))
		}
		if (isError) {
			return stateRow(
				<div className='flex flex-col items-center gap-1'>
					<Text size='sm' fw={600} c='slate.8'>
						{t('usersPage.table.loadError')}
					</Text>
					<Text size='xs'>{t(`errors.${getApiErrorCode(error)}`)}</Text>
					<Button variant='default' mt='md' loading={isRefetching} onClick={() => void refetch()}>
						{t('usersPage.table.retry')}
					</Button>
				</div>,
			)
		}
		if (data.users.length === 0) {
			return stateRow(<Text size='sm'>{t('usersPage.table.empty')}</Text>)
		}
		return data.users.map((user) => (
			<Table.Tr key={user.id} className={classes.tr}>
				<Table.Td className={classes.td}>
					<div className='flex items-center gap-3'>
						<Avatar size={32} radius='xl' color='slate.1' variant='filled' classNames={{ placeholder: classes.initials }}>
							{getInitials({ email: user.email, firstName: null, lastName: null })}
						</Avatar>
						<Text size='sm' fw={500} c='slate.8' className={classes.email}>
							{user.email}
						</Text>
					</div>
				</Table.Td>
				<Table.Td className={classes.td}>
					<Text size='xs'>{formatDate(user.createdAt, i18n.language)}</Text>
				</Table.Td>
			</Table.Tr>
		))
	}

	return (
		<div className={classes.card}>
			<Table aria-label={t('usersPage.table.label')} aria-busy={isPending} withRowBorders={false}>
				<Table.Thead>
					<Table.Tr>
						<Table.Th className={classes.th}>{t('usersPage.table.email')}</Table.Th>
						<Table.Th className={`${classes.th} ${classes.createdColumn}`}>{t('usersPage.table.createdAt')}</Table.Th>
					</Table.Tr>
				</Table.Thead>
				<Table.Tbody>{renderBody()}</Table.Tbody>
			</Table>
		</div>
	)
}

export default UsersTable
