import { type Language, type ProjectVersion, type VersionDiffSummary } from '@locale/shared'

export type TranslationsVersionBannerProps = {
	/** The version filtered on the page, else the current one by date. */
	version: ProjectVersion
	/** Keys of the version's work with a missing translation; shown when known and above zero. */
	untranslated?: number
	/** Target language of the compact view, named before the untranslated count it is for. */
	language?: Language
	/** How the version differs from the previous one; shown when known (a version without import has none). */
	diff?: VersionDiffSummary
	/** The signed-in user cannot write into a locked version (EDITOR, VISITOR). */
	writesBlocked: boolean
	/** Opens the lock / unlock confirmation of the version; only an ADMIN gets the button. */
	onToggleLock?: () => void
}
