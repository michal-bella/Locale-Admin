import { type Ref } from 'react'

import { type ProjectVersion } from '@locale/shared'

/** Each callback gets the button that opened the modal, so the page can return focus there when it closes. Only an ADMIN gets them. */
export type VersionsTableProps = {
	projectId: string
	onCreate?: (trigger: HTMLElement) => void
	onEdit?: (version: ProjectVersion, trigger: HTMLElement) => void
	/** Opens the lock confirmation; it locks an unlocked version and unlocks a locked one. */
	onToggleLock?: (version: ProjectVersion, trigger: HTMLElement) => void
	/** Focusable (`tabIndex={-1}`) so focus can land on the table when the opener is gone. */
	ref?: Ref<HTMLTableElement>
}
