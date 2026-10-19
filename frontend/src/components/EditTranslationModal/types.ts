import { type Language, type TranslationListItem } from '@locale/shared'

export type EditTranslationModalProps = {
	/** The key being edited; `null` while the modal is closed. */
	item: TranslationListItem | null
	/** The language being edited; `null` while the modal is closed. */
	language: Language | null
	/** Base language of the project; its value is shown as a reference unless it is the edited language. */
	baseLanguage?: Language
	opened: boolean
	onClose: () => void
	/** Saves the value; rejects with the API error (`PLACEHOLDER_MISMATCH` and a `VALIDATION_ERROR` on `value` show under the field). */
	onSave: (keyId: string, languageId: string, value: string | null) => Promise<unknown>
}
