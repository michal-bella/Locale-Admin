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

/** A form text must keep `{` and `}` balanced, otherwise the ICU message cannot be parsed back (the serializer does not escape braces). */
export const hasBalancedBraces = (text: string): boolean => {
	let depth = 0
	for (const char of text) {
		if (char === '{') {
			depth += 1
		} else if (char === '}') {
			depth -= 1
			if (depth < 0) {
				return false
			}
		}
	}
	return depth === 0
}

/**
 * A plural key stores one ICU message per language: `{count, plural, one {# položka} few {# položky} other {# položiek}}`.
 * Form texts may contain `{{var}}`, HTML and `#` (the number); braces inside a form are balanced like in ICU.
 */
export const serializePluralValue = ({ variable, forms }: PluralValue): string => {
	const parts = PLURAL_FORMS.filter((form) => forms[form] !== undefined).map((form) => `${form} {${forms[form]}}`)
	return `{${variable}, plural, ${parts.join(' ')}}`
}

/** `null` when the value is not a plural message of this shape (`=N` and `offset:` are not supported); strict so plain text is never mistaken for a plural. */
export const parsePluralValue = (value: string): PluralValue | null => {
	const head = /^\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*,\s*plural\s*,/.exec(value)
	if (!head || !value.endsWith('}')) {
		return null
	}
	const forms: Partial<Record<PluralForm, string>> = {}
	let index = head[0].length
	const end = value.length - 1
	while (index < end) {
		while (index < end && /\s/.test(value[index] ?? '')) {
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

/** `[start, end)` of every top-level `{…}` of a message; `null` when the braces are not balanced. */
const topLevelArguments = (value: string): { start: number; end: number }[] | null => {
	const segments: { start: number; end: number }[] = []
	let depth = 0
	let start = 0
	for (let index = 0; index < value.length; index += 1) {
		if (value[index] === '{') {
			if (depth === 0) {
				start = index
			}
			depth += 1
		} else if (value[index] === '}') {
			depth -= 1
			if (depth < 0) {
				return null
			}
			if (depth === 0) {
				segments.push({ start, end: index + 1 })
			}
		}
	}
	return depth === 0 ? segments : null
}

const PLURAL_ARGUMENT = /^\{\s*[A-Za-z_][A-Za-z0-9_]*\s*,\s*plural\s*,/

/**
 * Like `parsePluralValue`, but also accepts one plural argument inside other text, as Tolgee exports it: `{category}, {starCount, plural,
 * one {# star} other {# stars}}` becomes `starCount` with the forms `{category}, # star` and `{category}, # stars` (the text around the
 * plural goes into every form). `null` for no plural argument, more than one (`{hours, plural, …}{minutes, plural, …}`) or an unparseable one.
 */
export const normalizePluralValue = (value: string): PluralValue | null => {
	const direct = parsePluralValue(value)
	if (direct) {
		return direct
	}
	const plurals = (topLevelArguments(value) ?? []).filter(({ start, end }) => PLURAL_ARGUMENT.test(value.slice(start, end)))
	const [plural] = plurals
	if (plurals.length !== 1 || !plural) {
		return null
	}
	const parsed = parsePluralValue(value.slice(plural.start, plural.end))
	if (!parsed) {
		return null
	}
	const prefix = value.slice(0, plural.start)
	const suffix = value.slice(plural.end)
	const forms = Object.fromEntries(Object.entries(parsed.forms).map(([form, text]) => [form, `${prefix}${text}${suffix}`]))
	return { variable: parsed.variable, forms }
}

/**
 * Plural variable of a key judged from its values (import, edit key modal): the variable when at least one value is a plural message
 * (`normalizePluralValue`) and every plural message uses the same one; plain values do not count against it (they become the `other`
 * form). `null` otherwise.
 */
export const detectPluralVariable = (values: Iterable<string | null>): string | null => {
	const variables = new Set<string>()
	for (const value of values) {
		const parsed = value === null ? null : normalizePluralValue(value)
		if (parsed) {
			variables.add(parsed.variable)
		}
	}
	return variables.size === 1 ? ([...variables][0] ?? null) : null
}
