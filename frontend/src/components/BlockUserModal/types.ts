import { type AdminUserDetail } from '@locale/shared'

export type BlockUserModalProps = {
	user: AdminUserDetail
	/** Fixed when the modal opens: the saved block refetches the user while the modal is still closing. */
	action: 'block' | 'unblock'
	opened: boolean
	onClose: () => void
}
