import { type LanguageFlagCode } from '@locale/shared'

export type LanguageFlagProps = {
	code: LanguageFlagCode
	/** `lg` 40 px in the table, `sm` 20 px in selects. */
	size: 'lg' | 'sm'
}
