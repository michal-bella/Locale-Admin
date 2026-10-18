import { type TranslationsResponse } from '@locale/shared'

export type TranslationStatsProps = {
	/** Counts for the selected target language; `undefined` while loading shows skeletons. */
	stats?: TranslationsResponse['stats']
}
