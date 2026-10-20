import { type LanguageFlagCode } from '@locale/shared'

export type LanguageFlagProps = {
	code: LanguageFlagCode
	/** `lg` 40 px in the table, `sm` 20 px in selects, `xs` 16 px next to a label. */
	size: 'lg' | 'sm' | 'xs'
}
