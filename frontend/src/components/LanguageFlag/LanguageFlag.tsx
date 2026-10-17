import { AT, BG, CZ, GB, HR, HU, RO, RU, SK } from 'country-flag-icons/react/3x2'

import { type LanguageFlagCode } from '@locale/shared'

import classes from './LanguageFlag.module.css'
import { type LanguageFlagProps } from './types'

const FLAGS = {
	at: AT,
	bg: BG,
	cz: CZ,
	gb: GB,
	hr: HR,
	hu: HU,
	ro: RO,
	ru: RU,
	sk: SK,
} as const satisfies Record<LanguageFlagCode, unknown>

/** Decorative flag of a language; the language name is always shown next to it. */
const LanguageFlag = ({ code, variant }: LanguageFlagProps) => {
	const Flag = FLAGS[code]
	return (
		<Flag
			aria-hidden='true'
			data-flag={code}
			className={classes[variant]}
			// Crops the 3:2 flag to the circle instead of letterboxing it.
			preserveAspectRatio={variant === 'round' ? 'xMidYMid slice' : undefined}
		/>
	)
}

export default LanguageFlag
