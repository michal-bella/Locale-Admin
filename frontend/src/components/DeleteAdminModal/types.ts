import { type AdminUser } from '@locale/shared'

export type DeleteAdminModalProps = {
	opened: boolean
	/** Kept after closing, so the text does not disappear during the close transition. */
	admin: AdminUser | null
	onClose: () => void
	/** The admin is gone (deleted, or already deleted by someone else). */
	onDeleted: () => void
}
