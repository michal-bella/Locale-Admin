import { type AdminUser } from '@locale/shared'

export type DeleteUserModalProps = {
	opened: boolean
	/** Kept after closing, so the text does not disappear during the close transition. */
	user: AdminUser | null
	onClose: () => void
	/** The user is gone (deleted, or already deleted by someone else). */
	onDeleted: () => void
}
