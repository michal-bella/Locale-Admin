import { type ReactNode } from 'react'

export type TranslationEditorPlural = {
	/** Number variable of the key's ICU message (`count`). */
	variable: string
	/** BCP 47 tag of the target language, decides which forms are edited. */
	tag: string
}

export type TranslationEditorProps = {
	value: string | null
	/** Accessible name of the field and prefix of the display button: „Preklad kľúča orders.empty.title, English“. */
	label: string
	/** Set for a plural key: one field per form, saved as one ICU message. */
	plural?: TranslationEditorPlural | null
	/** Rejects with the API error; `PLACEHOLDER_MISMATCH` keeps the editor open, anything else shows a notification. */
	onSave: (value: string | null) => Promise<unknown>
	/** Read-only rendering of `value` (chips for variables). */
	children: ReactNode
}
