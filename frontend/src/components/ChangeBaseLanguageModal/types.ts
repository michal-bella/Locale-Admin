import { type Language } from '@locale/shared'

export type ChangeBaseLanguageModalProps = {
	opened: boolean
	/** The language moved to the first place, kept after closing so the text does not disappear during the close transition. */
	language: Language | null
	currentBase: Language | null
	isPending: boolean
	onConfirm: () => void
	/** "Nie", the X, Esc or an outside click: the dropped order is discarded. */
	onCancel: () => void
}
