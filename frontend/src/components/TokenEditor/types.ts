import { type FocusEvent, type KeyboardEvent, type Ref } from 'react'

export type TokenEditorProps = {
	value: string
	onChange: (value: string) => void
	/** Accessible name of the textbox. */
	label: string
	/** Also treats `#` (the number of an ICU plural form) as a chip. */
	pluralHash?: boolean
	/** Normalized placeholders of the base language; a placeholder chip outside the set gets a warning style and title. */
	basePlaceholders?: Set<string>
	describedBy?: string
	invalid?: boolean
	readOnly?: boolean
	/** Enforced on typing, paste and IME input; the value never gets longer. */
	maxLength?: number
	/**
	 * Lets the focus trap of an enclosing Mantine modal focus the editor (`data-autofocus`), the caret at the end. Focusing on mount
	 * would grab the focus before the modal records the opener, so the focus could not return to it on close.
	 */
	modalAutofocus?: boolean
	/** Runs first; a handler that calls `preventDefault` stops the editor's own Enter handling. */
	onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void
	onBlur?: (event: FocusEvent<HTMLDivElement>) => void
	className?: string
	ref?: Ref<HTMLDivElement>
}
