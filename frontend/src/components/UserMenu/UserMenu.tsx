import { Avatar, Menu, Text, UnstyledButton } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { getInitials, ROLE } from '@locale/shared'

import { useMeQuery } from '@/api/auth/meQuery'
import { useLogoutMutation } from '@/api/auth/useLogoutMutation'
import getApiErrorCode from '@/api/getApiErrorCode'

import classes from './UserMenu.module.css'

const UserMenu = () => {
	const { t } = useTranslation()
	const { data: user } = useMeQuery()
	const logout = useLogoutMutation()

	if (!user) {
		return null
	}

	const handleLogout = () =>
		logout.mutate(undefined, {
			onError: (error) => notifications.show({ color: 'red', message: t(`errors.${getApiErrorCode(error)}`) }),
		})

	return (
		<Menu position='bottom-end' width={240} radius='lg' shadow='md'>
			<Menu.Target>
				<UnstyledButton aria-label={t('topBar.userMenu.label')} className={classes.trigger}>
					<Avatar size={32} radius='xl' color='var(--app-color-avatar)' variant='filled' classNames={{ placeholder: classes.initials }}>
						{getInitials(user)}
					</Avatar>
				</UnstyledButton>
			</Menu.Target>
			<Menu.Dropdown>
				<Menu.Label>
					<Text component='span' fz='xs' fw={600} c='var(--app-color-text-strong)' className={classes.email}>
						{user.email}
					</Text>
				</Menu.Label>
				<Menu.Divider />
				{user.role === ROLE.ADMIN && (
					<Menu.Item component={Link} to='/admin/users'>
						{t('topBar.userMenu.users')}
					</Menu.Item>
				)}
				<Menu.Item onClick={handleLogout} disabled={logout.isPending}>
					{t('topBar.userMenu.logout')}
				</Menu.Item>
			</Menu.Dropdown>
		</Menu>
	)
}

export default UserMenu
