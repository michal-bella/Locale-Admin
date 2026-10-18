import { type Language } from '@locale/shared'

export type ConfirmDeleteModalProps = {
	projectId: string
	opened: boolean
	/** Kept after closing, so the text does not disappear during the close transition. */
	language: Language | null
	onClose: () => void
	/** The language is gone (deleted, or already deleted by someone else). */
	onDeleted: () => void
}
