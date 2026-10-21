import { type TranslationCell } from '@locale/shared'

export type TranslationCellProps = {
	cell: TranslationCell
	/** Accessible name prefix: „Preklad kľúča orders.empty.title, English“. */
	label: string
	/** Set for a plural key: BCP 47 tag of the language of the cell. */
	pluralTag?: string
	/** See `TranslationValue`. */
	reference?: string
	/** Opens the edit modal for this key and language. */
	onClick: () => void
}
