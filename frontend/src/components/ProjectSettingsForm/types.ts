import { type Language, type ProjectSettings } from '@locale/shared'

export type ProjectSettingsFormProps = {
	settings: ProjectSettings
	languages: Language[]
	/** Shows "Opustiť projekt"; an ADMIN may open a project without being its member. */
	isMember: boolean
	/** Called after the user left the project. */
	onLeft: () => void
	/** Called with the saved settings, after the project list and settings were refetched. */
	onSaved: (settings: ProjectSettings) => void
	/** Shows "Zrušiť" on the left when "Opustiť projekt" is not shown (the edit modal on Projekty). */
	onCancel?: () => void
	/** Moves focus to the first field when it turns true (after a successful retry replaced the focused retry button). */
	focusFirstField?: boolean
}
