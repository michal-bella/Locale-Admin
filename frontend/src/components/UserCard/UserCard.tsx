import { Avatar, Select, Text } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'

import { getInitials, ROLE } from '@locale/shared'

import { useUpdateUserMutation } from '@/api/adminUsers/useUpdateUserMutation'
import getApiErrorCode from '@/api/getApiErrorCode'
import EditUserEmailModal from '@/components/EditUserEmailModal/EditUserEmailModal'
import { ChevronDown, Edit } from '@/components/Icons'
import RowAction from '@/components/RowAction/RowAction'
import { formatDate } from '@/lib/formatDate'

import classes from './UserCard.module.css'
import { type UserCardProps } from './types'

/**
 * Header card of the user detail: avatar with initials from the email, the email with Upraviť e-mail, the created date and the global role
 * as a select that saves on change.
 */
const UserCard = ({ user }: UserCardProps) => {
	const { t, i18n } = useTranslation()
	const roleId = useId()
	const updateRole = useUpdateUserMutation(user.id)
	const [emailModalOpened, emailModal] = useDisclosure(false)

	const changeRole = (value: string | null) => {
		const role = Object.values(ROLE).find((candidate) => candidate === value)
		if (!role || role === user.role || updateRole.isPending) {
			return
		}
		updateRole.mutate(
			{ role },
			{
				onSuccess: () => notifications.show({ color: 'green', message: t('userPage.card.roleSaved') }),
				onError: (error) => notifications.show({ color: 'red', message: t(`errors.${getApiErrorCode(error)}`) }),
			},
		)
	}

	return (
		<section aria-label={t('userPage.card.label')} className={`${classes.card} flex flex-wrap items-center gap-4`}>
			<Avatar aria-hidden size={56} radius='xl' color='var(--app-color-avatar-muted)' variant='filled' classNames={{ placeholder: classes.initials }}>
				{getInitials({ email: user.email, firstName: null, lastName: null })}
			</Avatar>
			<div className={`${classes.identity} flex flex-col gap-1`}>
				<div className='flex items-center gap-1'>
					<Text component='h2' fz='lg' fw={700} c='var(--app-color-title)' className={classes.email}>
						{/* A long email breaks after the @ first, not inside the domain. */}
						{user.email.split('@').map((part, index) => (index === 0 ? part : [<wbr key={index} />, `@${part}`]))}
					</Text>
					<RowAction
						icon={Edit}
						tooltip={t('userPage.card.editEmail')}
						label={t('userPage.card.editEmailLabel', { email: user.email })}
						onClick={emailModal.open}
					/>
				</div>
				<Text size='xs' c='var(--app-color-muted)'>
					{t('userPage.card.createdAt', { date: formatDate(user.createdAt, i18n.language) })}
				</Text>
			</div>
			<Select
				id={roleId}
				label={t('userPage.card.role')}
				className={classes.role}
				value={user.role}
				onChange={changeRole}
				disabled={updateRole.isPending}
				allowDeselect={false}
				rightSection={<ChevronDown aria-hidden />}
				rightSectionPointerEvents='none'
				data={Object.values(ROLE).map((role) => ({ value: role, label: t(`roles.${role}`) }))}
			/>
			<EditUserEmailModal user={user} opened={emailModalOpened} onClose={emailModal.close} />
		</section>
	)
}

export default UserCard
