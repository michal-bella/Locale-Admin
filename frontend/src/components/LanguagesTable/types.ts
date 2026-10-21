import { type Ref } from 'react'

import { type Language } from '@locale/shared'

/** Each callback gets the button that opened it, so the page can return focus there when the modal closes. */
export type LanguagesTableProps = {
	projectId: string
	/** Only for an ADMIN, who alone adds languages; without it the empty state has no add button. */
	onAdd?: (trigger: HTMLElement) => void
	/** Only for an ADMIN, who alone removes languages; without it the table has no actions column. */
	onDelete?: (language: Language, trigger: HTMLElement | null) => void
	/** Only for an ADMIN: the grips that reorder the languages (and so change the base language). */
	reorderable?: boolean
	/** Focusable (`tabIndex={-1}`) so focus can land on the table when the row that had it is gone. */
	ref?: Ref<HTMLTableElement>
}
