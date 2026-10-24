import { type ACTIVITY_TYPE, type ActivityEvent } from '@locale/shared'

export type TranslationChangeEvent = Extract<ActivityEvent, { type: ACTIVITY_TYPE.TRANSLATION_UPDATED }>

export type TranslationChangeModalProps = {
	opened: boolean
	/** Kept by the caller after closing, so the content stays during the closing transition. */
	event: TranslationChangeEvent | null
	projectSlug: string
	onClose: () => void
}
