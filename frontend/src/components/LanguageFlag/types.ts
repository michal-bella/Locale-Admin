import { type LanguageFlagCode } from '@locale/shared'

export type LanguageFlagProps = {
	code: LanguageFlagCode
	/** `lg` 40 px in the table, `md` 32 px in the Prehľad language list, `sm` 20 px in selects, `xs` 16 px next to a label. */
	size: 'lg' | 'md' | 'sm' | 'xs'
}
