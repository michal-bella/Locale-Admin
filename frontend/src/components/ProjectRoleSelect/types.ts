import { type PROJECT_ROLE } from '@locale/shared'

export type ProjectRoleSelectProps = {
	value: PROJECT_ROLE
	onChange: (role: PROJECT_ROLE) => void
	disabled?: boolean
	/** Visible label with the description of the picked role under the input (modals); without it the select is compact (tables) and needs `ariaLabel`. */
	label?: string
	ariaLabel?: string
}
