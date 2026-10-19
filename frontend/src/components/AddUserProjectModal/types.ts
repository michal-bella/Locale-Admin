import { type AdminUserDetail } from '@locale/shared'

export type AddUserProjectModalProps = {
	user: AdminUserDetail
	opened: boolean
	onClose: () => void
}
