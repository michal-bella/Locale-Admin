/** CLDR plural categories in display order. A language uses a subset (`pluralFormsForTag`). */
export const PLURAL_FORMS = ['zero', 'one', 'two', 'few', 'many', 'other'] as const

export type PluralForm = (typeof PLURAL_FORMS)[number]

export const PLURAL_VARIABLE_DEFAULT = 'count'

export const PLURAL_VARIABLE_MAX_LENGTH = 50

export const PLURAL_VARIABLE_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/

/** Categories of a language from `Intl.PluralRules` (sk: one, few, many, other; en: one, other), in `PLURAL_FORMS` order. */
export const pluralFormsForTag = (tag: string): PluralForm[] => {
	const categories = new Set(new Intl.PluralRules(tag).resolvedOptions().pluralCategories)
	return PLURAL_FORMS.filter((form) => categories.has(form))
}

export type PluralValue = { variable: string; forms: Partial<Record<PluralForm, string>> }

/**
 * A plural key stores one ICU message per language: `{count, plural, one {# položka} few {# položky} other {# položiek}}`.
 * Form texts may contain `{{var}}`, HTML and `#` (the number); braces inside a form are balanced like in ICU.
 */
export const serializePluralValue = ({ variable, forms }: PluralValue): string => {
	const parts = PLURAL_FORMS.filter((form) => forms[form] !== undefined).map((form) => `${form} {${forms[form]}}`)
	return `{${variable}, plural, ${parts.join(' ')}}`
}

/** `null` when the value is not a plural message of this shape; parsing is strict so plain text is never mistaken for a plural. */
export const parsePluralValue = (value: string): PluralValue | null => {
	const head = /^\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*,\s*plural\s*,/.exec(value)
	if (!head || !value.endsWith('}')) {
		return null
	}
	const forms: Partial<Record<PluralForm, string>> = {}
	let index = head[0].length
	const end = value.length - 1
	while (index < end) {
		while (index < end && value[index] === ' ') {
			index += 1
		}
		if (index >= end) {
			break
		}
		const form = /^(zero|one|two|few|many|other)\s*\{/.exec(value.slice(index, end))
		if (!form) {
			return null
		}
		index += form[0].length
		let depth = 1
		const start = index
		while (index < end && depth > 0) {
			if (value[index] === '{') {
				depth += 1
			} else if (value[index] === '}') {
				depth -= 1
			}
			index += 1
		}
		if (depth !== 0) {
			return null
		}
		forms[form[1] as PluralForm] = value.slice(start, index - 1)
	}
	return { variable: head[1] as string, forms }
}
