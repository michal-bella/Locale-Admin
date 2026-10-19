import { type AdminUser, type ROLE } from '@locale/shared'

export type CreateUserModalProps = {
	opened: boolean
	onClose: () => void
	/** Preselected role; Člen (EDITOR) when omitted. */
	defaultRole?: ROLE
	/** The user was created and the modal is closing, e.g. to preselect them in the add-member select. */
	onCreated?: (user: AdminUser) => void
}
