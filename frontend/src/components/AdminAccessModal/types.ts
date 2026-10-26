import { type AdminUserDetail } from '@locale/shared'

export type AdminAccessModalProps = {
	user: AdminUserDetail
	/** Fixed when the modal opens: the saved role refetches the user while the modal is still closing. */
	action: 'grant' | 'revoke'
	opened: boolean
	onClose: () => void
}
