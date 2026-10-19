import { act, createEvent, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vite-plus/test'

import TokenEditor from './TokenEditor'
import { selectionOffsets, setCaret, TOKEN_ATTRIBUTE } from './editorDom'
import { type TokenEditorProps } from './types'

const LABEL = 'Preklad'

const Harness = ({ initial, onChange, ...props }: Partial<TokenEditorProps> & { initial: string }) => {
	const [value, setValue] = useState(initial)
	return (
		<TokenEditor
			{...props}
			value={value}
			label={LABEL}
			onChange={(next) => {
				setValue(next)
				onChange?.(next)
			}}
		/>
	)
}

const renderEditor = (initial: string, props: Partial<TokenEditorProps> = {}) => {
	const onChange = vi.fn()
	render(<Harness initial={initial} onChange={onChange} {...props} />)
	const field = screen.getByRole('textbox', { name: LABEL })
	return { field, onChange }
}

const chips = (field: HTMLElement) => Array.from(field.querySelectorAll(`[${TOKEN_ATTRIBUTE}]`)).map((chip) => chip.textContent)

const keyDown = (field: HTMLElement, init: KeyboardEventInit) => {
	const event = createEvent.keyDown(field, init)
	fireEvent(field, event)
	return event.defaultPrevented
}

const paste = (field: HTMLElement, text: string) => {
	const event = createEvent.paste(field, { clipboardData: { getData: () => text } })
	fireEvent(field, event)
}

describe('TokenEditor', () => {
	it('renders an accessible multiline textbox with the placeholders and tags as locked chips', () => {
		const { field } = renderEditor('Hi {{name}}, <b>bold</b>', { describedBy: 'hint', maxLength: 50 })
		expect(field).toHaveAttribute('aria-multiline', 'true')
		expect(field).toHaveAttribute('aria-describedby', 'hint')
		expect(field).toHaveAttribute('data-maxlength', '50')
		expect(field).toHaveAttribute('contenteditable', 'plaintext-only')
		expect(chips(field)).toEqual(['{{name}}', '<b>', '</b>'])
		expect(field.querySelectorAll('[contenteditable="false"]')).toHaveLength(3)
		expect(field).toHaveTextContent('Hi {{name}}, <b>bold</b>')
	})

	it('reports typed text and turns a typed placeholder into a chip', () => {
		const { field, onChange } = renderEditor('Hello')
		field.textContent = 'Hello {{name}}'
		fireEvent.input(field)
		expect(onChange).toHaveBeenLastCalledWith('Hello {{name}}')
		expect(chips(field)).toEqual(['{{name}}'])
	})

	it('follows an external value change', () => {
		const Controlled = ({ value }: { value: string }) => <TokenEditor value={value} label={LABEL} onChange={() => undefined} />
		const { rerender } = render(<Controlled value='one' />)
		rerender(<Controlled value='two {{x}}' />)
		expect(screen.getByRole('textbox', { name: LABEL })).toHaveTextContent('two {{x}}')
		expect(chips(screen.getByRole('textbox', { name: LABEL }))).toEqual(['{{x}}'])
	})

	it('removes a whole chip with Backspace after it and Delete before it', () => {
		const { field, onChange } = renderEditor('Hi {{name}}!')
		setCaret(field, 11)
		expect(keyDown(field, { key: 'Backspace' })).toBe(true)
		expect(onChange).toHaveBeenLastCalledWith('Hi !')
		expect(selectionOffsets(field)).toEqual([3, 3])

		field.textContent = ''
		fireEvent.input(field)
		field.textContent = 'a<br>b'
		fireEvent.input(field)
		setCaret(field, 1)
		expect(keyDown(field, { key: 'Delete' })).toBe(true)
		expect(onChange).toHaveBeenLastCalledWith('ab')
	})

	it('leaves Backspace and Delete to the browser when no chip touches the caret', () => {
		const { field, onChange } = renderEditor('Hi {{name}}!')
		setCaret(field, 2)
		expect(keyDown(field, { key: 'Backspace' })).toBe(false)
		expect(keyDown(field, { key: 'Delete' })).toBe(false)
		expect(onChange).not.toHaveBeenCalled()
	})

	it('inserts a newline on Enter, not on Ctrl/Cmd+Enter', () => {
		const { field, onChange } = renderEditor('ab')
		setCaret(field, 1)
		expect(keyDown(field, { key: 'Enter' })).toBe(true)
		expect(onChange).toHaveBeenLastCalledWith('a\nb')
		expect(selectionOffsets(field)).toEqual([2, 2])

		expect(keyDown(field, { key: 'Enter', ctrlKey: true })).toBe(true)
		expect(keyDown(field, { key: 'Enter', metaKey: true })).toBe(true)
		expect(onChange).toHaveBeenCalledTimes(1)
	})

	it('lets the parent handle a key first and skips its own handling when prevented', () => {
		const onKeyDown = vi.fn((event: { key: string; preventDefault: () => void }) => {
			if (event.key === 'Enter') {
				event.preventDefault()
			}
		})
		const { field, onChange } = renderEditor('ab', { onKeyDown })
		setCaret(field, 1)
		keyDown(field, { key: 'Enter' })
		expect(onKeyDown).toHaveBeenCalled()
		expect(onChange).not.toHaveBeenCalled()
	})

	it('pastes plain text at the selection and makes chips of its tokens', () => {
		const { field, onChange } = renderEditor('Hello world')
		setCaret(field, 5)
		paste(field, ' {{name}}<br>')
		expect(onChange).toHaveBeenLastCalledWith('Hello {{name}}<br> world')
		expect(chips(field)).toEqual(['{{name}}', '<br>'])
		expect(selectionOffsets(field)).toEqual([18, 18])
	})

	it('replaces a selected range on paste', () => {
		const { field, onChange } = renderEditor('Hello world')
		const range = document.createRange()
		range.setStart(field.firstChild as Node, 6)
		range.setEnd(field.firstChild as Node, 11)
		document.getSelection()?.removeAllRanges()
		document.getSelection()?.addRange(range)
		paste(field, 'there')
		expect(onChange).toHaveBeenLastCalledWith('Hello there')
	})

	it('enforces maxLength on typing, paste and input', () => {
		const { field, onChange } = renderEditor('12345', { maxLength: 6 })
		setCaret(field, 5)
		expect(keyDown(field, { key: 'a' })).toBe(false)
		expect(keyDown(field, { key: 'b' })).toBe(false)
		field.textContent = '123456'
		fireEvent.input(field)
		expect(onChange).toHaveBeenLastCalledWith('123456')
		setCaret(field, 6)
		expect(keyDown(field, { key: 'c' })).toBe(true)
		paste(field, 'xyz')
		expect(onChange).toHaveBeenLastCalledWith('123456')
		field.textContent = '123456789'
		fireEvent.input(field)
		expect(onChange).toHaveBeenLastCalledWith('123456')
	})

	it('is not editable while read-only', () => {
		const { field, onChange } = renderEditor('abc', { readOnly: true })
		expect(field).toHaveAttribute('aria-readonly', 'true')
		expect(field).toHaveAttribute('contenteditable', 'false')
		setCaret(field, 1)
		keyDown(field, { key: 'Enter' })
		paste(field, 'x')
		expect(onChange).not.toHaveBeenCalled()
	})

	it('marks itself for the focus trap of a modal and puts the caret at the end on that first focus', () => {
		const { field } = renderEditor('abc', { modalAutofocus: true })
		expect(field).toHaveAttribute('data-autofocus')
		act(() => field.focus())
		expect(selectionOffsets(field)).toEqual([3, 3])
	})

	it('treats # as plain text by default', () => {
		expect(chips(renderEditor('# items').field)).toEqual([])
	})

	it('treats # as a chip for plural forms and names it', () => {
		const { field } = renderEditor('# items', { pluralHash: true })
		expect(chips(field)).toEqual(['#'])
		expect(field.querySelector('[data-token]')).toHaveAttribute('title', 'Číslo')
	})
})
