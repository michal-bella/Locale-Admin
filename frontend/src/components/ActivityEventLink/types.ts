import { type ActivityEvent } from '@locale/shared'

export type ActivityEventLinkProps = {
	event: ActivityEvent
	projectSlug: string
	/** The time the list was rendered, so every row of it picks the same `updatedWithin`. */
	now: Date
}
