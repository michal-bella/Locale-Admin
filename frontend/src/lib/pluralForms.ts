import { PLURAL_FORMS, type PluralForm, parsePluralValue, pluralFormsForTag } from '@locale/shared'

/** Forms of a language plus any extra form already stored in the value, in CLDR order, so no stored form is hidden or lost. */
export const pluralFormsOf = (tag: string, forms: Partial<Record<PluralForm, string>>): PluralForm[] => {
	const languageForms = new Set(pluralFormsForTag(tag))
	return PLURAL_FORMS.filter((form) => languageForms.has(form) || forms[form] !== undefined)
}

/** Forms stored in a value; a non-plural (legacy or hand-written) value is the `other` form. */
export const parsePluralForms = (value: string | null): Partial<Record<PluralForm, string>> => {
	if (value === null) {
		return {}
	}
	return parsePluralValue(value)?.forms ?? { other: value }
}
