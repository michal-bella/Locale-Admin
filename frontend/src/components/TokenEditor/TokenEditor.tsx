import { type ClipboardEvent, type KeyboardEvent, useImperativeHandle, useLayoutEffect, useRef } from 'react'

import textClasses from '@/components/TranslationText/TranslationText.module.css'

import classes from './TokenEditor.module.css'
import { type ChipClassNames, render, selectionOffsets, serialize, setCaret } from './editorDom'
import { tokenize, tokenRanges } from './tokens'
import { type TokenEditorProps } from './types'

const CHIP_CLASS_NAMES: ChipClassNames = { placeholder: textClasses.chip, hash: textClasses.chip, tag: classes.tag }

/**
 * Plain-text editor (`contenteditable`) where `{{var}}` placeholders and HTML tags are atomic chips: the caret never enters them,
 * Backspace/Delete removes a whole chip, paste inserts plain text and Enter a newline. The DOM is rebuilt from the value after every
 * edit (caret restored by offset), so browser-made markup never survives and the value serializes back to the exact string.
 */
const TokenEditor = ({
	value,
	onChange,
	label,
	pluralHash = false,
	describedBy,
	invalid = false,
	readOnly = false,
	maxLength,
	focusOnMount = false,
	onKeyDown,
	onBlur,
	className,
	ref,
}: TokenEditorProps) => {
	const rootRef = useRef<HTMLDivElement>(null)
	const renderedRef = useRef<string | null>(null)
	const composingRef = useRef(false)

	useImperativeHandle(ref, () => rootRef.current as HTMLDivElement)

	const tokens = (text: string) => tokenize(text, { tags: true, hash: pluralHash })

	const commit = (next: string, caret: number) => {
		const root = rootRef.current
		if (!root) {
			return
		}
		render(root, tokens(next), CHIP_CLASS_NAMES)
		renderedRef.current = next
		setCaret(root, Math.min(caret, next.length))
		onChange(next)
	}

	useLayoutEffect(() => {
		const root = rootRef.current
		if (root && renderedRef.current !== value) {
			render(root, tokens(value), CHIP_CLASS_NAMES)
			renderedRef.current = value
			if (root.ownerDocument.activeElement === root) {
				setCaret(root, value.length)
			}
		}
	})

	useLayoutEffect(() => {
		const root = rootRef.current
		if (focusOnMount && root) {
			root.focus()
			setCaret(root, value.length)
		}
		// Only on mount, like the `autoFocus` attribute.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	const current = () => renderedRef.current ?? value

	const clip = (text: string, start: number, end: number) => {
		const room = maxLength === undefined ? text.length : Math.max(0, maxLength - (current().length - (end - start)))
		return text.slice(0, room)
	}

	const replaceSelection = (text: string) => {
		const root = rootRef.current
		const selection = root && selectionOffsets(root)
		if (!selection) {
			return
		}
		const [start, end] = selection
		const inserted = clip(text, start, end)
		commit(current().slice(0, start) + inserted + current().slice(end), start + inserted.length)
	}

	const handleInput = () => {
		const root = rootRef.current
		if (!root || composingRef.current) {
			return
		}
		const caret = selectionOffsets(root)?.[0] ?? 0
		let next = serialize(root)
		if (maxLength !== undefined && next.length > maxLength) {
			next = next.slice(0, maxLength)
		}
		commit(next, caret)
	}

	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		onKeyDown?.(event)
		if (event.defaultPrevented || readOnly || composingRef.current) {
			return
		}
		const root = rootRef.current
		const selection = root && selectionOffsets(root)
		if (event.key === 'Enter') {
			event.preventDefault()
			if (!event.ctrlKey && !event.metaKey) {
				replaceSelection('\n')
			}
			return
		}
		if (!selection) {
			return
		}
		const [start, end] = selection
		if (event.key === 'Backspace' && start === end) {
			const chip = tokenRanges(tokens(current())).find((range) => range.end === start)
			if (chip) {
				event.preventDefault()
				commit(current().slice(0, chip.start) + current().slice(chip.end), chip.start)
			}
			return
		}
		if (event.key === 'Delete' && start === end) {
			const chip = tokenRanges(tokens(current())).find((range) => range.start === start)
			if (chip) {
				event.preventDefault()
				commit(current().slice(0, chip.start) + current().slice(chip.end), chip.start)
			}
			return
		}
		if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && maxLength !== undefined && start === end && current().length >= maxLength) {
			event.preventDefault()
		}
	}

	const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
		event.preventDefault()
		if (!readOnly) {
			replaceSelection(event.clipboardData.getData('text/plain'))
		}
	}

	return (
		<div
			ref={rootRef}
			role='textbox'
			aria-multiline
			aria-label={label}
			aria-describedby={describedBy}
			aria-invalid={invalid || undefined}
			aria-readonly={readOnly || undefined}
			contentEditable={readOnly ? false : 'plaintext-only'}
			tabIndex={0}
			spellCheck={false}
			data-maxlength={maxLength}
			className={`${classes.root} ${className ?? ''}`}
			onInput={handleInput}
			onKeyDown={handleKeyDown}
			onPaste={handlePaste}
			onDrop={(event) => event.preventDefault()}
			onCompositionStart={() => {
				composingRef.current = true
			}}
			onCompositionEnd={() => {
				composingRef.current = false
				handleInput()
			}}
			onBlur={onBlur}
		/>
	)
}

export default TokenEditor
