import { type PluralForm } from '@locale/shared'

export type PluralFormsProps = {
	/** Stored ICU plural message of one language. */
	value: string
	/** BCP 47 tag of the language whose forms are shown. */
	tag: string
}

export type PluralFormChipProps = {
	form: PluralForm
}
