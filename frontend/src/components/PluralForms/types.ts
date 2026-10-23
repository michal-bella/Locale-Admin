import { type PluralForm } from '@locale/shared'

export type PluralFormsProps = {
	/** Stored ICU plural message of one language. */
	value: string
	/** BCP 47 tag of the language whose forms are shown. */
	tag: string
	/** Normalized placeholders of the base language, see `TranslationText`. */
	basePlaceholders?: Set<string>
	/** See `TranslationText`. */
	chipTooltips?: boolean
}

export type PluralFormChipProps = {
	form: PluralForm
}
