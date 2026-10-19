import { describe, expect, it } from 'vitest'

import { parsePluralValue, pluralFormsForTag, serializePluralValue } from './plurals'

describe('pluralFormsForTag', () => {
	it('returns the CLDR categories of a language in display order', () => {
		expect(pluralFormsForTag('sk')).toEqual(['one', 'few', 'many', 'other'])
		expect(pluralFormsForTag('en')).toEqual(['one', 'other'])
		expect(pluralFormsForTag('hr')).toEqual(['one', 'few', 'other'])
	})
})

describe('plural values', () => {
	it('round-trips forms with placeholders, HTML and nested braces', () => {
		const value = { variable: 'count', forms: { one: '# položka {{name}}', few: '# <strong>položky</strong>', other: '# položiek {x}' } }
		const serialized = serializePluralValue(value)
		expect(serialized).toBe('{count, plural, one {# položka {{name}}} few {# <strong>položky</strong>} other {# položiek {x}}}')
		expect(parsePluralValue(serialized)).toEqual(value)
	})

	it('keeps an empty form and skips undefined ones', () => {
		expect(parsePluralValue(serializePluralValue({ variable: 'n', forms: { one: '', other: 'x' } }))).toEqual({
			variable: 'n',
			forms: { one: '', other: 'x' },
		})
	})

	it('returns null for plain text, a {{var}} value and an unbalanced message', () => {
		expect(parsePluralValue('Máte {{count}} položiek')).toBeNull()
		expect(parsePluralValue('{count, plural, one {x}')).toBeNull()
		expect(parsePluralValue('{count, plural, bogus {x}}')).toBeNull()
	})
})
