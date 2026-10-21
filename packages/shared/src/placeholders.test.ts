import { describe, expect, it } from 'vitest'

import { comparePlaceholders, placeholders } from './placeholders'

describe('placeholders', () => {
	it('normalizes i18next variants and keeps the order of first appearance', () => {
		expect([...placeholders('{{ count }} of {{- name}} for {{price, currency}} and {{count}}')]).toEqual(['{{count}}', '{{name}}', '{{price}}'])
	})

	it('ignores single braces of an ICU plural message and finds a placeholder that opens a form', () => {
		expect([...placeholders('{count, plural, one {{{name}} x} other {# items of {{name}}}}')]).toEqual(['{{name}}'])
		expect([...placeholders('{count, plural, one {# item} other {# items}}')]).toEqual([])
	})

	it('finds ICU arguments as {name}, also inside plural forms and with a format', () => {
		expect([...placeholders('{rating, number} z 5, {count, plural, one {{count} osoba} other {{count} osôb}} ({category})')]).toEqual([
			'{rating}',
			'{count}',
			'{category}',
		])
		expect(comparePlaceholders('Show more ({remaining})', 'Zobraziť viac')).toEqual({ missing: ['{remaining}'], extra: [] })
	})

	it('compares against the base placeholders', () => {
		expect(comparePlaceholders('{{a}} {{b}}', '{{b}} {{c}}')).toEqual({ missing: ['{{a}}'], extra: ['{{c}}'] })
	})

	it('counts occurrences: a placeholder repeated more often than in the base is extra, fewer times is missing', () => {
		expect(comparePlaceholders('Show more ({{count}})', 'Zobraziť ({{count}}) ďalšie ({{count}})')).toEqual({ missing: [], extra: ['{{count}}'] })
		expect(comparePlaceholders('{{name}} ({{name}})', '{{name}}')).toEqual({ missing: ['{{name}}'], extra: [] })
		expect(comparePlaceholders('{{ count }} x {{count}}', '{{count}} y {{- count}}')).toEqual({ missing: [], extra: [] })
	})

	it('counts per plural form, so more forms than the base are fine but a form repeating a placeholder is not', () => {
		const base = '{count, plural, one {{{count}} item} other {{{count}} items}}'
		expect(
			comparePlaceholders(base, '{count, plural, one {{{count}} položka} few {{{count}} položky} many {{{count}} položky} other {{{count}} položiek}}'),
		).toEqual({
			missing: [],
			extra: [],
		})
		expect(comparePlaceholders(base, '{count, plural, one {{{count}} položka} other {{{count}} z {{count}} položiek}}')).toEqual({
			missing: [],
			extra: ['{{count}}'],
		})
	})
})
