import { type AdminUserDetail } from '@locale/shared'

export type SetUserPasswordModalProps = {
	user: AdminUserDetail
	opened: boolean
	onClose: () => void
}
