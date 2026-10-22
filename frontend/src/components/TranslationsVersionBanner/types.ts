import { type ProjectVersion } from '@locale/shared'

export type TranslationsVersionBannerProps = {
	/** The version filtered on the page, else the current one by date. */
	version: ProjectVersion
	/** The list is filtered to this version. */
	active: boolean
	/** Keys of the version's work with a missing translation; shown when known and above zero. */
	untranslated?: number
	/** The signed-in user cannot write into a locked version (EDITOR, VISITOR). */
	writesBlocked: boolean
	onShow: () => void
	onClear: () => void
	/** Opens the lock / unlock confirmation of the version; only an ADMIN gets the button. */
	onToggleLock?: () => void
}
