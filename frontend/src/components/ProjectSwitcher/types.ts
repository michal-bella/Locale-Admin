import { type ProjectSettings } from '@locale/shared'

export type ProjectSwitcherProps = {
	project: Pick<ProjectSettings, 'id' | 'name' | 'slug' | 'primaryColor'>
	/** Called after a project or the project list is chosen (closes the mobile sidebar). */
	onNavigate: () => void
	/** Only the avatar, the menu opens to the right (compact sidebar). */
	compact?: boolean
}
