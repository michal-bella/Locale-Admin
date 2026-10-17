import { type LanguageFlagCode } from '@locale/shared'

export type LanguageFlagProps = {
	code: LanguageFlagCode
	/** `round` 40 px circle in the table, `rect` 20 px wide 3:2 flag in selects. */
	variant: 'round' | 'rect'
}
