import { type ReactNode } from 'react'

export type TranslationEditorProps = {
	value: string | null
	/** Accessible name of the field and prefix of the display button: „Preklad kľúča orders.empty.title, English“. */
	label: string
	/** Rejects with the API error; `PLACEHOLDER_MISMATCH` keeps the editor open, anything else shows a notification. */
	onSave: (value: string | null) => Promise<unknown>
	/** Read-only rendering of `value` (chips for variables). */
	children: ReactNode
}
