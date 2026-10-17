import { type Language } from '@locale/shared'

export type LanguageSettingsModalProps = {
	opened: boolean
	/** Kept after closing, so the content does not disappear during the close transition. */
	language: Language | null
	onClose: () => void
	onDelete: (language: Language) => void
	/** The delete confirmation is open on top of this modal. */
	inBackground: boolean
}
