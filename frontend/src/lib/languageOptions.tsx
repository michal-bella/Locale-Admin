import { type ComboboxItem, type ComboboxLikeRenderOptionInput, type ComboboxRenderPillInput, Pill } from '@mantine/core'

import { type LanguageTag, SUPPORTED_LANGUAGES } from '@locale/shared'

import LanguageFlag from '@/components/LanguageFlag/LanguageFlag'

export const findSupportedLanguage = (tag: string | null) => SUPPORTED_LANGUAGES.find((language) => language.tag === tag)

/** Options of the catalog for a Select or MultiSelect, searchable by English name, native name and tag. */
export const getLanguageOptions = (disabledTags: ReadonlySet<LanguageTag> = new Set()): ComboboxItem[] =>
	SUPPORTED_LANGUAGES.map((language) => ({
		value: language.tag,
		label: `${language.englishName} – ${language.nativeName} – ${language.tag}`,
		disabled: disabledTags.has(language.tag),
	}))

export const renderLanguageOption = ({ option }: ComboboxLikeRenderOptionInput<ComboboxItem>) => {
	const language = findSupportedLanguage(option.value)
	return (
		<span className='flex items-center gap-2'>
			{language && <LanguageFlag code={language.flagCode} size='sm' />}
			{option.label}
		</span>
	)
}

/** A selected language in a MultiSelect: the flag before the label, like the options. */
export const renderLanguagePill = ({ option, onRemove, disabled }: ComboboxRenderPillInput) => {
	const language = findSupportedLanguage(String(option.value))
	return (
		<Pill withRemoveButton onRemove={onRemove} disabled={disabled}>
			<span className='flex items-center gap-1.5'>
				{language && <LanguageFlag code={language.flagCode} size='sm' />}
				{option.label}
			</span>
		</Pill>
	)
}
