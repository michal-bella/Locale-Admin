const PLACEHOLDER_PATTERN = /\{\{(.*?)\}\}/g

/** i18next variants are the same placeholder: `{{ count }}`, `{{- count}}` (unescaped) and `{{count, number}}` (formatted) are `{{count}}`. */
const normalizePlaceholder = (inner: string) => `{{${inner.replace(/\s+/g, '').replace(/^-/, '').split(',')[0] ?? ''}}}`

/** Normalized `{{…}}` placeholders of a value. The set keeps the order of first appearance. */
export const placeholders = (value: string): Set<string> =>
	new Set([...value.matchAll(PLACEHOLDER_PATTERN)].map((match) => normalizePlaceholder(match[1] ?? '')))

const difference = (a: Set<string>, b: Set<string>) => [...a].filter((item) => !b.has(item))

/** Placeholders of `base` missing in `value` and placeholders of `value` not in `base`. */
export const comparePlaceholders = (base: Set<string>, value: string): { missing: string[]; extra: string[] } => {
	const own = placeholders(value)
	return { missing: difference(base, own), extra: difference(own, base) }
}
