import { describe, expect, it } from 'vitest'

import { detectPluralVariable, hasBalancedBraces, normalizePluralValue, parsePluralValue, pluralFormsForTag, serializePluralValue } from './plurals'

describe('pluralFormsForTag', () => {
	it('returns the CLDR categories of a language in display order', () => {
		expect(pluralFormsForTag('sk')).toEqual(['one', 'few', 'other'])
		expect(pluralFormsForTag('cs')).toEqual(['one', 'few', 'other'])
		expect(pluralFormsForTag('ru')).toEqual(['one', 'few', 'many', 'other'])
		expect(pluralFormsForTag('pl')).toEqual(['one', 'few', 'many', 'other'])
		expect(pluralFormsForTag('fr')).toEqual(['one', 'many', 'other'])
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

describe('hasBalancedBraces', () => {
	it('accepts balanced and nested braces and rejects unbalanced ones', () => {
		expect(hasBalancedBraces('a {{name}} b {x}')).toBe(true)
		expect(hasBalancedBraces('')).toBe(true)
		expect(hasBalancedBraces('a}')).toBe(false)
		expect(hasBalancedBraces('{a')).toBe(false)
		expect(hasBalancedBraces('}{')).toBe(false)
	})
})

describe('parsePluralValue separators', () => {
	it('accepts newlines and tabs between forms', () => {
		expect(parsePluralValue('{count, plural,\n\tone {a}\n\tother {b}\n}')).toEqual({ variable: 'count', forms: { one: 'a', other: 'b' } })
	})
})

describe('detectPluralVariable', () => {
	const SK = '{count, plural, one {# položka} few {# položky} other {# položiek}}'
	const EN = '{count, plural, one {# item} other {# items}}'

	it('returns the variable shared by every plural message, ignoring null and plain values', () => {
		expect(detectPluralVariable([SK, EN])).toBe('count')
		expect(detectPluralVariable([SK, null, 'Položky'])).toBe('count')
		expect(detectPluralVariable(['({count, plural, one {{count} hodnotenie} other {{count} hodnotení}})', 'undefined'])).toBe('count')
	})

	it('returns null without a plural message or when the variables differ', () => {
		expect(detectPluralVariable([])).toBeNull()
		expect(detectPluralVariable(['Položky', null, '{count} items'])).toBeNull()
		expect(detectPluralVariable([SK, '{n, plural, one {# item} other {# items}}'])).toBeNull()
	})
})

describe('normalizePluralValue', () => {
	it('returns a plain plural message as parsePluralValue does', () => {
		const value = '{count, plural, one {{count} osoba} few {{count} osoby} other {{count} osôb}}'
		expect(normalizePluralValue(value)).toEqual(parsePluralValue(value))
	})

	it('moves the text around one plural argument into every form', () => {
		expect(normalizePluralValue('{category}, {starCount, plural, one {# hviezdička} other {# hviezdičiek}}')).toEqual({
			variable: 'starCount',
			forms: { one: '{category}, # hviezdička', other: '{category}, # hviezdičiek' },
		})
		expect(normalizePluralValue('({totalCount, plural, one {{totalCount} hodnotenie} other {{totalCount} hodnotení}})')).toEqual({
			variable: 'totalCount',
			forms: { one: '({totalCount} hodnotenie)', other: '({totalCount} hodnotení)' },
		})
	})

	it('returns null for plain text, two plural arguments, =N selectors and unbalanced braces', () => {
		expect(normalizePluralValue('Zobraziť ďalšie žiadosti ({remainingRequestsCount})')).toBeNull()
		expect(normalizePluralValue('{starCount, plural, one {# star} other {# stars}}, {reviewCount, plural, one {# review} other {# reviews}}')).toBeNull()
		expect(normalizePluralValue('{hours, plural, =0 {} one {# hour} other {# hours}} spolu')).toBeNull()
		expect(normalizePluralValue('{count, plural, one {# item} other {# items}')).toBeNull()
	})
})
