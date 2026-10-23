import { type TranslationStatus } from '@locale/shared'

export type TranslationStatusBadgeProps = {
	status: TranslationStatus
	/** In a narrow table (`@container` below 65rem) only the dot shows; the label stays for screen readers. */
	collapsible?: boolean
}
