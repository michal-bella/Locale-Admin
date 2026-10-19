import { type ImportPreviewResponse, type Language } from '@locale/shared'

/** `languageId` of the project per column index, `null` = skip the column, a missing entry = not decided yet. */
export type ImportColumnMapping = Partial<Record<number, string | null>>

export type ImportReviewTableProps = {
	preview: ImportPreviewResponse
	languages: Language[]
	mapping: ImportColumnMapping
	onChange: (columnIndex: number, choice: string | null) => void
	/** Called with the file tag of a `CATALOG` column; the language is added to the project and the preview runs again. */
	onAddLanguage: (tag: string) => void
	/** Tag whose language is being added, its button shows `loading`. */
	addingTag: string | null
	disabled: boolean
}
