import { type TranslationsResponse, type TranslationStatus } from '@locale/shared'

export type TranslationStatsProps = {
	/** Counts for the selected target language; `undefined` while loading shows skeletons. */
	stats?: TranslationsResponse['stats']
	/** The active status filter of the table. */
	status?: TranslationStatus
	/** Sets or clears (`undefined`) the status filter of the table. */
	onStatusChange: (status: TranslationStatus | undefined) => void
}
