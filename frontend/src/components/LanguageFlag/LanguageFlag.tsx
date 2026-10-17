import { type LanguageFlagCode } from '@locale/shared'

import At from '@/components/Flags/At'
import Bg from '@/components/Flags/Bg'
import Cz from '@/components/Flags/Cz'
import Gb from '@/components/Flags/Gb'
import Hr from '@/components/Flags/Hr'
import Hu from '@/components/Flags/Hu'
import Ro from '@/components/Flags/Ro'
import Ru from '@/components/Flags/Ru'
import Sk from '@/components/Flags/Sk'

import classes from './LanguageFlag.module.css'
import { type LanguageFlagProps } from './types'

const FLAGS = {
	at: At,
	bg: Bg,
	cz: Cz,
	gb: Gb,
	hr: Hr,
	hu: Hu,
	ro: Ro,
	ru: Ru,
	sk: Sk,
} as const satisfies Record<LanguageFlagCode, unknown>

/** Decorative round flag of a language; the language name is always shown next to it. */
const LanguageFlag = ({ code, size }: LanguageFlagProps) => {
	const Flag = FLAGS[code]
	return <Flag aria-hidden='true' data-flag={code} className={classes[size]} />
}

export default LanguageFlag
