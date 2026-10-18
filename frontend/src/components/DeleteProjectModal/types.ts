import { type AdminProjectListItem } from '@locale/shared'

export type DeleteProjectModalProps = {
	opened: boolean
	/** Kept after closing, so the text does not disappear during the close transition. */
	project: AdminProjectListItem | null
	onClose: () => void
	/** The project is gone (deleted, or already deleted by someone else). */
	onDeleted: () => void
}
