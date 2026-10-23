import { parsePluralValue } from './plurals'

/**
 * i18next `{{…}}` first (no brace inside, so `{{{name}}` yields `{{name}}`), then an ICU argument `{name}` / `{name, number, …}` as
 * Tolgee writes them. An ICU argument starts with a name, so plural form bodies (`{# item}`) and plural/select arguments are not placeholders.
 */
const PLACEHOLDER_PATTERN = /\{\{([^{}]*)\}\}|\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*(?:,\s*(?:number|date|time)\s*(?:,[^{}]*)?)?\}/g

/** i18next variants are the same placeholder: `{{ count }}`, `{{- count}}` (unescaped) and `{{count, number}}` (formatted) are `{{count}}`. */
const normalizePlaceholder = (inner: string) => `{{${inner.replace(/\s+/g, '').replace(/^-/, '').split(',')[0] ?? ''}}}`

const placeholderList = (value: string): string[] =>
	[...value.matchAll(PLACEHOLDER_PATTERN)].map((match) => (match[2] === undefined ? normalizePlaceholder(match[1] ?? '') : `{${match[2]}}`))

/** Normalized placeholders of a value: `{{count}}` for i18next, `{count}` for ICU. The set keeps the order of first appearance. */
export const placeholders = (value: string): Set<string> => new Set(placeholderList(value))

/**
 * How many times each placeholder occurs. A plural message counts per form and keeps the maximum, so a language with more plural
 * forms than the base is not a mismatch, while a form that repeats a placeholder is.
 */
const placeholderCounts = (value: string): Map<string, number> => {
	const plural = parsePluralValue(value)
	const texts = plural ? Object.values(plural.forms).filter((form): form is string => form !== undefined) : [value]
	const counts = new Map<string, number>()
	for (const text of texts) {
		const own = new Map<string, number>()
		for (const placeholder of placeholderList(text)) {
			own.set(placeholder, (own.get(placeholder) ?? 0) + 1)
		}
		for (const [placeholder, count] of own) {
			counts.set(placeholder, Math.max(counts.get(placeholder) ?? 0, count))
		}
	}
	return counts
}

/**
 * Placeholders of `base` that `value` has fewer times (`missing`) and placeholders `value` has more times than `base` (`extra`), so a
 * translation must use every variable exactly as often as the base language: `{{count}} ({{count}})` against `({{count}})` is an extra.
 */
export const comparePlaceholders = (base: string, value: string): { missing: string[]; extra: string[] } => {
	const expected = placeholderCounts(base)
	const own = placeholderCounts(value)
	return {
		missing: [...expected].filter(([placeholder, count]) => (own.get(placeholder) ?? 0) < count).map(([placeholder]) => placeholder),
		extra: [...own].filter(([placeholder, count]) => (expected.get(placeholder) ?? 0) < count).map(([placeholder]) => placeholder),
	}
}

/**
 * What a cell's placeholders are compared with, or `null` when it is not checked. A sentence key that names variables is the reference
 * for every language, the base included, so a base value that dropped a variable is the one flagged. Otherwise the base value is the
 * reference (the key name while the base is empty) and the base itself is not checked. A plural key keeps the base value, because its
 * forms may write the count as `#`.
 */
export const placeholderReference = (key: { name: string; plural: boolean }, baseValue: string | null, isBase: boolean): string | null => {
	const nameHasPlaceholders = placeholders(key.name).size > 0
	if (nameHasPlaceholders && !key.plural) {
		return key.name
	}
	if (isBase) {
		return null
	}
	return baseValue ?? (nameHasPlaceholders ? key.name : null)
}
