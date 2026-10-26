import { type AdminUser } from '@locale/shared'

export type CreateUserModalProps = {
	opened: boolean
	onClose: () => void
	/** The user was created and the modal is closing, e.g. to preselect them in the add-member select. */
	onCreated?: (user: AdminUser) => void
}
