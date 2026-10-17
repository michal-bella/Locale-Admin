import { type Language, type ProjectSettings } from '@locale/shared'

export type ProjectSettingsFormProps = {
	settings: ProjectSettings
	languages: Language[]
	/** Moves focus to the first field when it turns true (after a successful retry replaced the focused retry button). */
	focusFirstField?: boolean
}
