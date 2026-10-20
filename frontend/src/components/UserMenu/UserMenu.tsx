import { Avatar, Menu, Text, UnstyledButton, VisuallyHidden } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { getInitials } from '@locale/shared'

import { useMeQuery } from '@/api/auth/meQuery'
import { useLogoutMutation } from '@/api/auth/useLogoutMutation'
import getApiErrorCode from '@/api/getApiErrorCode'

import classes from './UserMenu.module.css'

/** User block (Figma 3:1742) at the right end of the top bar: avatar, name and global role; the whole block opens the user menu. */
const UserMenu = () => {
	const { t } = useTranslation()
	const { data: user } = useMeQuery()
	const logout = useLogoutMutation()

	if (!user) {
		return null
	}

	const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ')

	const handleLogout = () =>
		logout.mutate(undefined, {
			onError: (error) => notifications.show({ color: 'red', message: t(`errors.${getApiErrorCode(error)}`) }),
		})

	return (
		<Menu position='bottom-end' width={240} radius='lg' shadow='md'>
			<Menu.Target>
				{/* The hidden prefix keeps the visible name and role in the accessible name (WCAG 2.5.3). */}
				<UnstyledButton className={`${classes.root} flex items-center gap-3`}>
					<VisuallyHidden>{t('sidebar.userMenu.label')}</VisuallyHidden>
					<Avatar aria-hidden size={32} radius='xl' color='var(--app-color-avatar)' variant='filled' classNames={{ placeholder: classes.initials }}>
						{getInitials(user)}
					</Avatar>
					<div className='flex min-w-0 flex-1 flex-col'>
						<Text component='span' fz='xs' fw={600} lh='xs' c='var(--app-color-text-strong)' truncate>
							{fullName || user.email}
						</Text>
						<Text component='span' fz='3xs' lh={1.5} c='var(--app-color-muted)'>
							{t(`roles.${user.role}`)}
						</Text>
					</div>
				</UnstyledButton>
			</Menu.Target>
			<Menu.Dropdown>
				<Menu.Label>
					<Text component='span' fz='xs' fw={600} c='var(--app-color-text-strong)' className={classes.email}>
						{user.email}
					</Text>
				</Menu.Label>
				<Menu.Divider />
				<Menu.Item component={Link} to='/profile'>
					{t('sidebar.userMenu.profile')}
				</Menu.Item>
				<Menu.Item onClick={handleLogout} disabled={logout.isPending}>
					{t('sidebar.userMenu.logout')}
				</Menu.Item>
			</Menu.Dropdown>
		</Menu>
	)
}

export default UserMenu
