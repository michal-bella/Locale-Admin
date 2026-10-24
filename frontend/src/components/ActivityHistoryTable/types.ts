import { type ActivityEvent } from '@locale/shared'

export type ActivityHistoryTableProps = {
	projectSlug: string
	/** `undefined` while the first page loads. */
	events: ActivityEvent[] | undefined
	error: unknown
	isRefetching: boolean
	onRetry: () => void
	/** Filters are on: the empty state offers to clear them instead of saying the project has no activity. */
	filtered: boolean
	onResetFilters: () => void
}
