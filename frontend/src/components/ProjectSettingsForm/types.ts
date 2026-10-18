import { type Language, type ProjectSettings } from '@locale/shared'

export type ProjectSettingsFormProps = {
	settings: ProjectSettings
	languages: Language[]
	/** Only an ADMIN may change the global base language. */
	isAdmin: boolean
	/** Shows "Opustiť projekt"; an ADMIN may open a project without being its member. */
	isMember: boolean
	/** Called after the user left the project. */
	onLeft: () => void
	/** Moves focus to the first field when it turns true (after a successful retry replaced the focused retry button). */
	focusFirstField?: boolean
}
