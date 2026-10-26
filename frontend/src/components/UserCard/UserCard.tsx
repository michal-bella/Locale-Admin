import { Avatar, Switch, Text } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { getInitials, ROLE } from '@locale/shared'

import AdminAccessModal from '@/components/AdminAccessModal/AdminAccessModal'
import EditUserEmailModal from '@/components/EditUserEmailModal/EditUserEmailModal'
import { Edit } from '@/components/Icons'
import RowAction from '@/components/RowAction/RowAction'
import { formatDate } from '@/lib/formatDate'

import classes from './UserCard.module.css'
import { type UserCardProps } from './types'

/**
 * Header card of the user detail: avatar with initials from the email, the email with Upraviť e-mail, the created date and the Administrátor
 * switch (the global role), which saves only after the confirmation in `AdminAccessModal`.
 */
const UserCard = ({ user }: UserCardProps) => {
	const { t, i18n } = useTranslation()
	const [emailModalOpened, emailModal] = useDisclosure(false)
	const [adminModalOpened, adminModal] = useDisclosure(false)
	const [adminAction, setAdminAction] = useState<'grant' | 'revoke'>('grant')

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
			<Switch
				label={t('adminAccess.label')}
				checked={user.role === ROLE.ADMIN}
				onChange={() => {
					setAdminAction(user.role === ROLE.ADMIN ? 'revoke' : 'grant')
					adminModal.open()
				}}
				withThumbIndicator={false}
			/>
			<EditUserEmailModal user={user} opened={emailModalOpened} onClose={emailModal.close} />
			<AdminAccessModal user={user} action={adminAction} opened={adminModalOpened} onClose={adminModal.close} />
		</section>
	)
}

export default UserCard
