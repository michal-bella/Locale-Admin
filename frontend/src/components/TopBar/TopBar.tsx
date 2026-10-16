import { useTranslation } from 'react-i18next'

import Brand from '@/components/Brand/Brand'
import { Bell } from '@/components/Icons'
import LanguageSwitcher from '@/components/LanguageSwitcher/LanguageSwitcher'
import ThemeSwitcher from '@/components/ThemeSwitcher/ThemeSwitcher'
import UserMenu from '@/components/UserMenu/UserMenu'

import classes from './TopBar.module.css'

/** Phase 1 top bar composed of Figma elements (node 28:2). The bell is static until notifications exist. */
const TopBar = () => {
	const { t } = useTranslation()

	return (
		<header className={`${classes.root} flex items-center justify-between px-8`}>
			<Brand />
			<div className='flex items-center gap-2'>
				<LanguageSwitcher />
				<ThemeSwitcher />
				<div role='img' aria-label={t('topBar.notifications')} className={classes.notifications}>
					<Bell aria-hidden />
				</div>
				<UserMenu />
			</div>
		</header>
	)
}

export default TopBar
