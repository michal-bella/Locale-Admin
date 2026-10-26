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
	/** Opens the next untranslated cell after a save; without it Uložiť a ďalší is hidden and Cmd/Ctrl+Enter saves and closes. */
	onNext?: () => void
	/** Focus the first field when the content switches while the modal stays open (Uložiť a ďalší); on open Mantine focuses it. */
	focusOnSwitch?: boolean
	/** Only shows the translation (a VISITOR): the value as text instead of the editor, no copying and only Zavrieť in the footer. */
	readOnly?: boolean
	/** Name of the previous version, for the toggle of a changed translation's previous value; without it the text says „predchádzajúcej verzie“. */
	previousVersionName?: string
}
