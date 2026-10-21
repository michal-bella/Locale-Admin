import { type CreateTranslationKeyResponse, type Language } from '@locale/shared'

export type CreateKeyModalProps = {
	projectId: string
	/** Languages of the project in their order; each gets an optional value field. */
	languages: Language[]
	/** Every namespace of the project; the new key must go into one of them. */
	namespaces: string[]
	/** Preselected namespace (the active filter); otherwise the only namespace, if there is one. */
	defaultNamespace?: string
	opened: boolean
	onClose: () => void
	/** Called with the saved key after the modal closed. */
	onCreated: (key: CreateTranslationKeyResponse) => void
}
