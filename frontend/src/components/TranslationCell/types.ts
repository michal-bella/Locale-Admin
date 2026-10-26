import { type TranslationCell } from '@locale/shared'

export type TranslationCellProps = {
	cell: TranslationCell
	/** Accessible name prefix: „Preklad kľúča orders.empty.title, English“. */
	label: string
	/** Set for a plural key: BCP 47 tag of the language of the cell. */
	pluralTag?: string
	/** See `TranslationValue`. */
	reference?: string
	/** The value differs from the previous version of the project (diff of the version): brand left border and a hidden „Zmenené“. */
	changed?: boolean
	/** Opens `EditTranslationModal` for this key and language (read-only where the user cannot write). */
	onClick: () => void
}
