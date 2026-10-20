import { type AdminUserDetail } from '@locale/shared'

export type EditUserEmailModalProps = {
	user: AdminUserDetail
	opened: boolean
	onClose: () => void
}
