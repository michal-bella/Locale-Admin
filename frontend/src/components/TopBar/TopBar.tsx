import { AppShell, Burger } from '@mantine/core'
import { useTranslation } from 'react-i18next'

import LanguageSwitcher from '@/components/LanguageSwitcher/LanguageSwitcher'
import ThemeSwitcher from '@/components/ThemeSwitcher/ThemeSwitcher'

import classes from './TopBar.module.css'
import { type TopBarProps } from './types'

/** Top bar of Figma 3:817 without breadcrumbs and the help icon. */
const TopBar = ({ navbarId, navOpened = false, onToggleNav, burgerRef, start, end }: TopBarProps) => {
	const { t } = useTranslation()

	return (
		<AppShell.Header withBorder={false} className={`${classes.root} flex items-center gap-2 px-8`}>
			{onToggleNav && (
				<Burger
					ref={burgerRef}
					hiddenFrom='md'
					size='sm'
					opened={navOpened}
					onClick={onToggleNav}
					aria-label={t('sidebar.openNavigation')}
					aria-expanded={navOpened}
					aria-controls={navbarId}
				/>
			)}
			{start}
			<div className='ml-auto flex items-center gap-2'>
				<LanguageSwitcher />
				<ThemeSwitcher />
				{end}
			</div>
		</AppShell.Header>
	)
}

export default TopBar
