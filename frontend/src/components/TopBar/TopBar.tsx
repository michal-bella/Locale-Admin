import { AppShell, Burger } from '@mantine/core'
import { useTranslation } from 'react-i18next'

import { Bell } from '@/components/Icons'
import LanguageSwitcher from '@/components/LanguageSwitcher/LanguageSwitcher'
import ThemeSwitcher from '@/components/ThemeSwitcher/ThemeSwitcher'

import classes from './TopBar.module.css'
import { type TopBarProps } from './types'

/** Top bar of Figma 3:817 without breadcrumbs and the help icon. The bell is static until notifications exist. */
const TopBar = ({ navbarId, navOpened, onToggleNav, burgerRef }: TopBarProps) => {
	const { t } = useTranslation()

	return (
		<AppShell.Header withBorder={false} className={`${classes.root} flex items-center gap-2 px-8`}>
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
			<div className='ml-auto flex items-center gap-2'>
				<LanguageSwitcher />
				<ThemeSwitcher />
				<div role='img' aria-label={t('topBar.notifications')} className={classes.notifications}>
					<Bell aria-hidden />
				</div>
			</div>
		</AppShell.Header>
	)
}

export default TopBar
