import { type Token } from './tokens'

export const TOKEN_ATTRIBUTE = 'data-token'

const FILLER_ATTRIBUTE = 'data-filler'

/** Zero-width space: a caret needs a text node next to a chip, the serialized value never contains it. */
const ZWSP = String.fromCharCode(0x200b)

const ZWSP_PATTERN = new RegExp(ZWSP, 'g')

export type ChipClassNames = Record<Exclude<Token['type'], 'text'>, string | undefined>

export type ChipTitles = Partial<Record<Exclude<Token['type'], 'text'>, string>>

/** Extra class and title of one chip, e.g. the warning of a placeholder the base language lacks. */
export type ChipDecoration = { className: string; title: string }

const isChip = (node: Node): node is HTMLElement => node instanceof HTMLElement && node.hasAttribute(TOKEN_ATTRIBUTE)

const isFiller = (node: Node) => node instanceof HTMLElement && node.hasAttribute(FILLER_ATTRIBUTE)

const isBlock = (node: Node) => node instanceof HTMLElement && (node.tagName === 'DIV' || node.tagName === 'P')

type Segment = { node: Node; text: string; kind: 'text' | 'chip' | 'break' }

/**
 * Leaves of the editor in document order with the text each one contributes: text nodes (without ZWSP), chips (their original token),
 * `<br>` (a newline; the trailing filler nothing) and a newline before every block element the browser may have inserted.
 */
const segments = (root: Node): Segment[] => {
	const result: Segment[] = []
	const walk = (node: Node, first: boolean) => {
		if (node.nodeType === Node.TEXT_NODE) {
			result.push({ node, text: (node.textContent ?? '').replace(ZWSP_PATTERN, ''), kind: 'text' })
			return
		}
		if (isChip(node)) {
			result.push({ node, text: node.getAttribute(TOKEN_ATTRIBUTE) ?? '', kind: 'chip' })
			return
		}
		if (node instanceof HTMLElement && node.tagName === 'BR') {
			result.push({ node, text: isFiller(node) ? '' : '\n', kind: 'break' })
			return
		}
		if (node !== root && isBlock(node) && !first) {
			result.push({ node, text: '\n', kind: 'break' })
		}
		node.childNodes.forEach((child, index) => walk(child, index === 0))
	}
	walk(root, true)
	return result
}

export const serialize = (root: Node): string =>
	segments(root)
		.map((segment) => segment.text)
		.join('')

/** Rebuilds the editor content: text nodes and chips, ZWSP where a caret could not be placed otherwise, a filler `<br>` after a trailing newline. */
export const render = (
	root: HTMLElement,
	tokens: Token[],
	classNames: ChipClassNames,
	titles: ChipTitles = {},
	decorate?: (token: Token) => ChipDecoration | undefined,
) => {
	root.replaceChildren()
	let previousWasChip = true
	for (const token of tokens) {
		if (token.type === 'text') {
			root.append(document.createTextNode(token.value))
			previousWasChip = false
			continue
		}
		if (previousWasChip) {
			root.append(document.createTextNode(ZWSP))
		}
		const chip = document.createElement('span')
		chip.setAttribute(TOKEN_ATTRIBUTE, token.value)
		chip.setAttribute('contenteditable', 'false')
		chip.className = classNames[token.type] ?? ''
		const decoration = decorate?.(token)
		if (decoration) {
			chip.classList.add(decoration.className)
		}
		const title = decoration?.title ?? titles[token.type]
		if (title) {
			chip.title = title
		}
		chip.textContent = token.value
		root.append(chip)
		previousWasChip = true
	}
	const last = tokens.at(-1)
	if (last && last.type !== 'text') {
		root.append(document.createTextNode(ZWSP))
	}
	if (last?.type === 'text' && last.value.endsWith('\n')) {
		const filler = document.createElement('br')
		filler.setAttribute(FILLER_ATTRIBUTE, '')
		root.append(filler)
	}
}

/** Offset in the serialized value of a DOM position; a position inside a chip counts as after it. */
const offsetAt = (root: HTMLElement, container: Node, offset: number): number => {
	const range = document.createRange()
	range.setStart(root, 0)
	range.setEnd(container, offset)
	return serialize(range.cloneContents()).length
}

/** `[start, end]` of the selection inside `root` in serialized offsets, `null` when the selection is elsewhere. */
export const selectionOffsets = (root: HTMLElement): [number, number] | null => {
	const selection = root.ownerDocument.getSelection()
	if (!selection || selection.rangeCount === 0) {
		return null
	}
	const range = selection.getRangeAt(0)
	if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) {
		return null
	}
	return [offsetAt(root, range.startContainer, range.startOffset), offsetAt(root, range.endContainer, range.endOffset)]
}

/** Index inside a text node for a serialized offset, skipping ZWSP. */
const indexInText = (text: string, offset: number): number => {
	let visible = 0
	for (let index = 0; index < text.length; index += 1) {
		if (visible === offset && text[index] !== ZWSP) {
			return index
		}
		if (text[index] !== ZWSP) {
			visible += 1
		}
	}
	return text.length
}

/** Collapses the selection at a serialized offset; a text node wins over a chip boundary so typing lands in text. */
export const setCaret = (root: HTMLElement, offset: number) => {
	const selection = root.ownerDocument.getSelection()
	if (!selection) {
		return
	}
	const range = document.createRange()
	let position = 0
	let placed = false
	for (const segment of segments(root)) {
		const end = position + segment.text.length
		if (segment.kind === 'text' && offset <= end) {
			range.setStart(segment.node, indexInText(segment.node.textContent ?? '', offset - position))
			placed = true
			break
		}
		// Boundaries of a chip belong to the ZWSP or text next to it; only an offset inside a chip (never produced by this editor) lands here.
		if (segment.kind !== 'text' && offset < end) {
			range.setStartAfter(segment.node)
			placed = true
			break
		}
		position = end
	}
	if (!placed) {
		const last = root.lastChild
		if (last && isFiller(last)) {
			range.setStartBefore(last)
		} else {
			range.setStart(root, root.childNodes.length)
		}
	}
	range.collapse(true)
	selection.removeAllRanges()
	selection.addRange(range)
}
