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

	it('compares against the base placeholders', () => {
		expect(comparePlaceholders(placeholders('{{a}} {{b}}'), '{{b}} {{c}}')).toEqual({ missing: ['{{a}}'], extra: ['{{c}}'] })
	})
})
