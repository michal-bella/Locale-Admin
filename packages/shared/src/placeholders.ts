/**
 * i18next `{{…}}` first (no brace inside, so `{{{name}}` yields `{{name}}`), then an ICU argument `{name}` / `{name, number, …}` as
 * Tolgee writes them. An ICU argument starts with a name, so plural form bodies (`{# item}`) and plural/select arguments are not placeholders.
 */
const PLACEHOLDER_PATTERN = /\{\{([^{}]*)\}\}|\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*(?:,\s*(?:number|date|time)\s*(?:,[^{}]*)?)?\}/g

/** i18next variants are the same placeholder: `{{ count }}`, `{{- count}}` (unescaped) and `{{count, number}}` (formatted) are `{{count}}`. */
const normalizePlaceholder = (inner: string) => `{{${inner.replace(/\s+/g, '').replace(/^-/, '').split(',')[0] ?? ''}}}`

/** Normalized placeholders of a value: `{{count}}` for i18next, `{count}` for ICU. The set keeps the order of first appearance. */
export const placeholders = (value: string): Set<string> =>
	new Set([...value.matchAll(PLACEHOLDER_PATTERN)].map((match) => (match[2] === undefined ? normalizePlaceholder(match[1] ?? '') : `{${match[2]}}`)))

const difference = (a: Set<string>, b: Set<string>) => [...a].filter((item) => !b.has(item))

/** Placeholders of `base` missing in `value` and placeholders of `value` not in `base`. */
export const comparePlaceholders = (base: Set<string>, value: string): { missing: string[]; extra: string[] } => {
	const own = placeholders(value)
	return { missing: difference(base, own), extra: difference(own, base) }
}
