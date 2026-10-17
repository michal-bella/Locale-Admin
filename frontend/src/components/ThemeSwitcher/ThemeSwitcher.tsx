import { ActionIcon, useComputedColorScheme, useMantineColorScheme } from '@mantine/core'
import { useTranslation } from 'react-i18next'

import { Moon, Sun } from '@/components/Icons'
import { DEFAULT_COLOR_SCHEME } from '@/lib/constants'

import classes from './ThemeSwitcher.module.css'

/** Toggles light and dark; Mantine's `colorSchemeManager` stores the choice in localStorage and sets `data-mantine-color-scheme` on `<html>`. */
const ThemeSwitcher = () => {
	const { t } = useTranslation()
	const { setColorScheme } = useMantineColorScheme()
	const isDark = useComputedColorScheme(DEFAULT_COLOR_SCHEME) === 'dark'
	const Icon = isDark ? Sun : Moon

	return (
		<ActionIcon
			variant='subtle'
			color='slate'
			size={38}
			radius='md'
			aria-label={t(isDark ? 'topBar.theme.toLight' : 'topBar.theme.toDark')}
			onClick={() => setColorScheme(isDark ? 'light' : 'dark')}
			className={classes.root}
		>
			<Icon aria-hidden width={18} height={18} />
		</ActionIcon>
	)
}

export default ThemeSwitcher
