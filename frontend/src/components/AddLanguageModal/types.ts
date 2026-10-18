import { type Language } from '@locale/shared'

export type AddLanguageModalProps = {
	projectId: string
	opened: boolean
	onClose: () => void
	/** Languages of the project, disabled in the select. */
	languages: Language[]
}
