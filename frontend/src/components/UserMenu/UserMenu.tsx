import { ActionIcon, Avatar, Menu, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { getInitials } from '@locale/shared'

import { useMeQuery } from '@/api/auth/meQuery'
import { useLogoutMutation } from '@/api/auth/useLogoutMutation'
import getApiErrorCode from '@/api/getApiErrorCode'
import { DotsHorizontal } from '@/components/Icons'

import classes from './UserMenu.module.css'
import { type UserMenuProps } from './types'

/** User block (Figma 3:1742): avatar, name, global role and the `⋯` menu. At the bottom of the sidebar or in the top bar of the project list. */
const UserMenu = ({ onNavigate, placement = 'sidebar' }: UserMenuProps) => {
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
		<div data-placement={placement} className={`${classes.root} flex items-center gap-3`}>
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
			<Menu position={placement === 'sidebar' ? 'top-end' : 'bottom-end'} width={240} radius='lg' shadow='md'>
				<Menu.Target>
					<ActionIcon variant='transparent' size={32} radius='md' aria-label={t('sidebar.userMenu.label')} className={classes.trigger}>
						<DotsHorizontal aria-hidden />
					</ActionIcon>
				</Menu.Target>
				<Menu.Dropdown>
					<Menu.Label>
						<Text component='span' fz='xs' fw={600} c='var(--app-color-text-strong)' className={classes.email}>
							{user.email}
						</Text>
					</Menu.Label>
					<Menu.Divider />
					<Menu.Item component={Link} to='/profile' onClick={onNavigate}>
						{t('sidebar.userMenu.profile')}
					</Menu.Item>
					<Menu.Item onClick={handleLogout} disabled={logout.isPending}>
						{t('sidebar.userMenu.logout')}
					</Menu.Item>
				</Menu.Dropdown>
			</Menu>
		</div>
	)
}

export default UserMenu
