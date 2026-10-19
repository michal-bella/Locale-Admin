export type TokenType = 'text' | 'placeholder' | 'tag' | 'hash'

export type Token = { type: TokenType; value: string }

export type TokenizeOptions = {
	/** HTML tags (`<strong>`, `</a>`, `<br/>`, `<a href="…">`) as tokens. */
	tags?: boolean
	/** `#` (the number of an ICU plural form) as a token. */
	hash?: boolean
}

/** `{{var}}` and `{{ var }}`; the same shape `TranslationText` and the backend placeholder check use. */
const PLACEHOLDER = '\\{\\{[^{}]+\\}\\}'

const TAG = '<\\/?[A-Za-z][^<>]*>'

const HASH = '#'

/** Splits a translation value into plain text and atomic tokens; the concatenated `value`s give the input back. */
export const tokenize = (value: string, { tags = true, hash = false }: TokenizeOptions = {}): Token[] => {
	const groups: { type: TokenType; pattern: string }[] = [
		{ type: 'placeholder', pattern: PLACEHOLDER },
		...(tags ? [{ type: 'tag' as const, pattern: TAG }] : []),
		...(hash ? [{ type: 'hash' as const, pattern: HASH }] : []),
	]
	const pattern = new RegExp(groups.map((group) => `(${group.pattern})`).join('|'), 'g')
	const tokens: Token[] = []
	let last = 0
	for (const match of value.matchAll(pattern)) {
		if (match.index > last) {
			tokens.push({ type: 'text', value: value.slice(last, match.index) })
		}
		const group = groups.findIndex((_, index) => match[index + 1] !== undefined)
		tokens.push({ type: groups[group]?.type ?? 'text', value: match[0] })
		last = match.index + match[0].length
	}
	if (last < value.length) {
		tokens.push({ type: 'text', value: value.slice(last) })
	}
	return tokens
}

/** `[start, end)` of every non-text token, for caret logic that treats a token as one character. */
export const tokenRanges = (tokens: Token[]): { start: number; end: number; token: Token }[] => {
	const ranges: { start: number; end: number; token: Token }[] = []
	let offset = 0
	for (const token of tokens) {
		if (token.type !== 'text') {
			ranges.push({ start: offset, end: offset + token.value.length, token })
		}
		offset += token.value.length
	}
	return ranges
}
