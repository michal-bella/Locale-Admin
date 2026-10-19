import { afterEach, describe, expect, it } from 'vite-plus/test'

import { render, selectionOffsets, serialize, setCaret, TOKEN_ATTRIBUTE } from './editorDom'
import { tokenize } from './tokens'

const CLASS_NAMES = { placeholder: 'placeholder', tag: 'tag', hash: 'hash' }

const mount = (value: string) => {
	const root = document.createElement('div')
	document.body.append(root)
	render(root, tokenize(value, { hash: true }), CLASS_NAMES)
	return root
}

afterEach(() => {
	document.body.replaceChildren()
	document.getSelection()?.removeAllRanges()
})

describe('render and serialize', () => {
	it.each(['', 'plain', 'Hi {{name}}!', '{{a}}{{b}}', '<b>x</b>', 'line 1\nline 2', 'trailing\n', '{{x}}', '# items'])('round-trips %j', (value) => {
		expect(serialize(mount(value))).toBe(value)
	})

	it('renders chips as non-editable elements carrying the original token', () => {
		const root = mount('Hi {{name}}<br>')
		const chips = Array.from(root.querySelectorAll(`[${TOKEN_ATTRIBUTE}]`))
		expect(chips.map((chip) => chip.getAttribute(TOKEN_ATTRIBUTE))).toEqual(['{{name}}', '<br>'])
		expect(chips.map((chip) => chip.getAttribute('contenteditable'))).toEqual(['false', 'false'])
		expect(chips.map((chip) => chip.className)).toEqual(['placeholder', 'tag'])
	})

	it('serializes a chip from its token even when its visible text was damaged', () => {
		const root = mount('Hi {{name}}')
		const chip = root.querySelector(`[${TOKEN_ATTRIBUTE}]`)
		if (!chip) {
			throw new Error('chip not found')
		}
		chip.textContent = '{{na'
		expect(serialize(root)).toBe('Hi {{name}}')
	})

	it('reads browser-made line breaks and blocks as newlines', () => {
		const root = document.createElement('div')
		root.innerHTML = 'a<br>b<div>c</div>'
		expect(serialize(root)).toBe('a\nb\nc')
	})

	it('adds a filler line break after a trailing newline and never counts it', () => {
		const root = mount('a\n')
		expect(root.lastElementChild?.tagName).toBe('BR')
		expect(serialize(root)).toBe('a\n')
	})
})

describe('caret', () => {
	it.each([0, 1, 3, 11, 15, 16])('round-trips offset %i through setCaret and selectionOffsets', (offset) => {
		const root = mount('Hi {{name}}<br>!')
		setCaret(root, offset)
		expect(selectionOffsets(root)).toEqual([offset, offset])
	})

	it('places the caret in text next to a chip, never inside it', () => {
		const root = mount('Hi {{name}}!')
		setCaret(root, 3)
		const range = document.getSelection()?.getRangeAt(0)
		expect(range?.startContainer.nodeType).toBe(Node.TEXT_NODE)
		expect(range?.startContainer.textContent).toBe('Hi ')
		setCaret(root, 11)
		expect(document.getSelection()?.getRangeAt(0).startContainer.textContent).toBe('!')
	})

	it('counts a position inside a chip as after the chip', () => {
		const root = mount('Hi {{name}}!')
		const chip = root.querySelector(`[${TOKEN_ATTRIBUTE}]`)
		if (!chip?.firstChild) {
			throw new Error('chip not found')
		}
		const range = document.createRange()
		range.setStart(chip.firstChild, 2)
		range.collapse(true)
		document.getSelection()?.addRange(range)
		expect(selectionOffsets(root)).toEqual([11, 11])
	})

	it('returns null when the selection is outside the editor', () => {
		const root = mount('abc')
		const other = document.createElement('p')
		other.textContent = 'elsewhere'
		document.body.append(other)
		const range = document.createRange()
		range.setStart(other.firstChild as Node, 1)
		document.getSelection()?.addRange(range)
		expect(selectionOffsets(root)).toBeNull()
	})

	it('reports a non-collapsed selection as a range', () => {
		const root = mount('Hello {{name}}')
		const range = document.createRange()
		range.setStart(root.firstChild as Node, 1)
		range.setEnd(root.firstChild as Node, 4)
		document.getSelection()?.addRange(range)
		expect(selectionOffsets(root)).toEqual([1, 4])
	})
})
