import { describe, expect, it } from 'vite-plus/test'

import { tokenize, tokenRanges } from './tokens'

describe('tokenize', () => {
	it('keeps plain text as one token', () => {
		expect(tokenize('Hello world')).toEqual([{ type: 'text', value: 'Hello world' }])
		expect(tokenize('')).toEqual([])
	})

	it('splits {{var}} and {{ var }} placeholders', () => {
		expect(tokenize('Hi {{name}}, {{ count }} items')).toEqual([
			{ type: 'text', value: 'Hi ' },
			{ type: 'placeholder', value: '{{name}}' },
			{ type: 'text', value: ', ' },
			{ type: 'placeholder', value: '{{ count }}' },
			{ type: 'text', value: ' items' },
		])
	})

	it('splits opening, closing, self-closing tags and tags with attributes', () => {
		expect(tokenize('<strong>Bold</strong><br/>see <a href="/terms" target="_blank">terms</a>')).toEqual([
			{ type: 'tag', value: '<strong>' },
			{ type: 'text', value: 'Bold' },
			{ type: 'tag', value: '</strong>' },
			{ type: 'tag', value: '<br/>' },
			{ type: 'text', value: 'see ' },
			{ type: 'tag', value: '<a href="/terms" target="_blank">' },
			{ type: 'text', value: 'terms' },
			{ type: 'tag', value: '</a>' },
		])
	})

	it('leaves braces without a name, a lone < and {{}} as text', () => {
		expect(tokenize('{1} {# x} 1 < 2 {{}} done')).toEqual([{ type: 'text', value: '{1} {# x} 1 < 2 {{}} done' }])
	})

	it('splits ICU arguments {var} and {var, number} but not plural arguments', () => {
		expect(tokenize('Zobraziť ďalšie ({remainingRequestsCount}), {rating, number} z 5')).toEqual([
			{ type: 'text', value: 'Zobraziť ďalšie (' },
			{ type: 'placeholder', value: '{remainingRequestsCount}' },
			{ type: 'text', value: '), ' },
			{ type: 'placeholder', value: '{rating, number}' },
			{ type: 'text', value: ' z 5' },
		])
		expect(tokenize('{count, plural, other {# x}}').filter((token) => token.type !== 'text')).toEqual([])
	})

	it('treats tags as text when turned off and # as a token only when asked', () => {
		expect(tokenize('<b>#</b>', { tags: false })).toEqual([{ type: 'text', value: '<b>#</b>' }])
		expect(tokenize('<b>#</b>', { hash: true })).toEqual([
			{ type: 'tag', value: '<b>' },
			{ type: 'hash', value: '#' },
			{ type: 'tag', value: '</b>' },
		])
		expect(tokenize('# {{count}} #', { tags: false, hash: true })).toEqual([
			{ type: 'hash', value: '#' },
			{ type: 'text', value: ' ' },
			{ type: 'placeholder', value: '{{count}}' },
			{ type: 'text', value: ' ' },
			{ type: 'hash', value: '#' },
		])
	})

	it.each(['Welcome back, {{name}}', '<p>{{a}}</p>\n{{b}}', 'line 1\nline 2\n', '{{x}}{{y}}', 'a {{ x }} <br> b'])(
		'joins back to the input (%s)',
		(value) => {
			expect(
				tokenize(value)
					.map((token) => token.value)
					.join(''),
			).toBe(value)
		},
	)
})

describe('tokenRanges', () => {
	it('gives the offsets of every non-text token', () => {
		expect(tokenRanges(tokenize('Hi {{name}}<br>!'))).toEqual([
			{ start: 3, end: 11, token: { type: 'placeholder', value: '{{name}}' } },
			{ start: 11, end: 15, token: { type: 'tag', value: '<br>' } },
		])
	})
})
