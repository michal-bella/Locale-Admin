import { type Ref } from 'react'

import { type Language } from '@locale/shared'

/** Each callback gets the button that opened it, so the page can return focus there when the modal closes. */
export type LanguagesTableProps = {
	onAdd: (trigger: HTMLElement) => void
	onEdit: (language: Language, trigger: HTMLElement | null) => void
	onDelete: (language: Language, trigger: HTMLElement | null) => void
	/** Focusable (`tabIndex={-1}`) so focus can land on the table when the row that had it is gone. */
	ref?: Ref<HTMLTableElement>
}
