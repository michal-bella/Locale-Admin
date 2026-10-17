import { type Profile } from '@locale/shared'

export type ProfileFormProps = {
	profile: Profile
	/** Moves focus to the first field when it turns true (after a successful retry replaced the focused retry button). */
	focusFirstField?: boolean
}
