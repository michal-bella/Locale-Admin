import { describe, expect, it } from 'vitest'

import { comparePlaceholders, placeholderReference, placeholders } from './placeholders'

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

describe('placeholderReference', () => {
	const sentence = { name: 'Na udalosť je prihlásených {{count}} ľudí.', plural: false }

	it('uses a sentence key with variables for every language, the base included', () => {
		expect(placeholderReference(sentence, 'Klientom bude odoslaná notifikácia.', true)).toBe(sentence.name)
		expect(placeholderReference(sentence, 'Klientom bude odoslaná notifikácia.', false)).toBe(sentence.name)
	})

	it('uses the base value for a key without variables and does not check the base', () => {
		const path = { name: 'orders.empty.title', plural: false }
		expect(placeholderReference(path, 'Máte {{count}} objednávok', false)).toBe('Máte {{count}} objednávok')
		expect(placeholderReference(path, 'Máte {{count}} objednávok', true)).toBeNull()
		expect(placeholderReference(path, null, false)).toBeNull()
	})

	it('keeps the base value for a plural key, whose forms may write the count as #', () => {
		const plural = { name: '{{count}} položiek', plural: true }
		expect(placeholderReference(plural, '{count, plural, one {# položka} other {# položiek}}', false)).toBe(
			'{count, plural, one {# položka} other {# položiek}}',
		)
		expect(placeholderReference(plural, null, false)).toBe(plural.name)
		expect(placeholderReference(plural, '{count, plural, other {# položiek}}', true)).toBeNull()
	})
})
