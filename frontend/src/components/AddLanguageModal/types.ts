import { type Language } from '@locale/shared'

export type AddLanguageModalProps = {
	opened: boolean
	onClose: () => void
	/** Already added languages, disabled in the select. */
	languages: Language[]
}
