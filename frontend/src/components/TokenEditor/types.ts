import { type FocusEvent, type KeyboardEvent, type Ref } from 'react'

export type TokenEditorProps = {
	value: string
	onChange: (value: string) => void
	/** Accessible name of the textbox. */
	label: string
	/** Also treats `#` (the number of an ICU plural form) as a chip. */
	pluralHash?: boolean
	describedBy?: string
	invalid?: boolean
	readOnly?: boolean
	/** Enforced on typing, paste and IME input; the value never gets longer. */
	maxLength?: number
	/** Focuses the editor on mount with the caret at the end. */
	focusOnMount?: boolean
	/** Runs first; a handler that calls `preventDefault` stops the editor's own Enter handling. */
	onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void
	onBlur?: (event: FocusEvent<HTMLDivElement>) => void
	className?: string
	ref?: Ref<HTMLDivElement>
}
