import { type ComboboxItem, type ComboboxLikeRenderOptionInput, SegmentedControl, Select, Text, TextInput } from '@mantine/core'
import { useDebouncedCallback } from '@mantine/hooks'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { type Language, TRANSLATIONS_SEARCH_MAX_LENGTH, translationsSortSchema, translationStatusSchema, translationsViewSchema } from '@locale/shared'

import { ArrowRight, Search } from '@/components/Icons'
import LanguageFlag from '@/components/LanguageFlag/LanguageFlag'
import { findSupportedLanguage } from '@/lib/languageOptions'

import classes from './TranslationsToolbar.module.css'
import { type TranslationsToolbarProps } from './types'

const SEARCH_DEBOUNCE_MS = 300

const ALL_STATUSES = 'ALL' as const

const renderLanguageOption = ({ option }: ComboboxLikeRenderOptionInput<ComboboxItem>) => {
	const language = findSupportedLanguage(option.value)
	return (
		<span className='flex items-center gap-2'>
			{language && <LanguageFlag code={language.flagCode} size='sm' />}
			<span className='font-semibold'>{option.label}</span>
			{language && <span className={classes.optionHint}>{language.nativeName}</span>}
		</span>
	)
}

const LanguageSelect = ({
	label,
	languages,
	value,
	onChange,
}: {
	label: string
	languages: Language[]
	value?: Language
	onChange: (tag: Language['tag']) => void
}) => (
	<Select
		aria-label={label}
		className={classes.languageSelect}
		data={languages.map((language) => ({ value: language.tag, label: language.tag.toUpperCase() }))}
		value={value?.tag ?? null}
		onChange={(tag) => {
			const language = languages.find((item) => item.tag === tag)
			if (language) {
				onChange(language.tag)
			}
		}}
		allowDeselect={false}
		disabled={languages.length === 0}
		leftSection={value && <LanguageFlag code={value.flagCode} size='sm' />}
		renderOption={renderLanguageOption}
		comboboxProps={{ width: 220, position: 'bottom-end' }}
		withScrollArea={false}
	/>
)

/**
 * Filters above the translations table (Figma 3:121): search, status, namespace, sort, the view switch and, in the compact view,
 * source → target language. The search writes to the URL 300 ms after the last keystroke; the other filters right away.
 */
const TranslationsToolbar = ({
	search,
	status,
	namespace,
	sort,
	view,
	onViewChange,
	isViewSaving = false,
	languages,
	sourceLanguage,
	targetLanguage,
	namespaces,
	onChange,
}: TranslationsToolbarProps) => {
	const { t } = useTranslation()
	const [searchValue, setSearchValue] = useState(search ?? '')
	const [committedSearch, setCommittedSearch] = useState(search)
	const commitSearch = useDebouncedCallback((value: string) => onChange({ search: value.trim() || undefined }), SEARCH_DEBOUNCE_MS)

	// The URL changed without typing (Zrušiť filtre, back button), so the field shows the URL value.
	if (search !== committedSearch) {
		setCommittedSearch(search)
		if ((search ?? '') !== searchValue.trim()) {
			setSearchValue(search ?? '')
		}
	}

	const namespaceOptions = namespaces.filter(Boolean)

	return (
		<div className='flex flex-wrap items-center gap-3'>
			<div className='flex flex-1 flex-wrap items-center gap-2'>
				<TextInput
					aria-label={t('translationsPage.toolbar.search.label')}
					placeholder={t('translationsPage.toolbar.search.placeholder')}
					leftSection={<Search aria-hidden />}
					maxLength={TRANSLATIONS_SEARCH_MAX_LENGTH}
					className={classes.search}
					value={searchValue}
					onChange={(event) => {
						setSearchValue(event.currentTarget.value)
						commitSearch(event.currentTarget.value)
					}}
				/>
				<Select
					aria-label={t('translationsPage.toolbar.status.label')}
					className={classes.select}
					data={[ALL_STATUSES, ...translationStatusSchema.options].map((value) => ({
						value,
						label: t(`translationsPage.toolbar.status.${value}`),
					}))}
					value={status ?? ALL_STATUSES}
					onChange={(value) => {
						const parsed = translationStatusSchema.safeParse(value)
						onChange({ status: parsed.success ? parsed.data : undefined })
					}}
					allowDeselect={false}
					withScrollArea={false}
				/>
				{/* An active filter stays visible even when the project has one namespace left. */}
				{(namespaceOptions.length > 1 || namespace !== undefined) && (
					<Select
						aria-label={t('translationsPage.toolbar.namespace.label')}
						placeholder={t('translationsPage.toolbar.namespace.placeholder')}
						className={classes.select}
						data={namespaceOptions}
						value={namespace ?? null}
						onChange={(value) => onChange({ namespace: value ?? undefined })}
						clearable
					/>
				)}
				<Select
					aria-label={t('translationsPage.toolbar.sort.label')}
					className={classes.select}
					data={translationsSortSchema.options.map((value) => ({ value, label: t(`translationsPage.toolbar.sort.${value}`) }))}
					value={sort}
					onChange={(value) => {
						const parsed = translationsSortSchema.safeParse(value)
						onChange({ sort: parsed.success && parsed.data !== 'UNTRANSLATED_FIRST' ? parsed.data : undefined })
					}}
					allowDeselect={false}
					withScrollArea={false}
				/>
			</div>
			<div className='flex flex-wrap items-center gap-3'>
				<SegmentedControl
					aria-label={t('translationsPage.view.label')}
					value={view}
					disabled={isViewSaving}
					onChange={(value) => {
						const parsed = translationsViewSchema.safeParse(value)
						if (parsed.success) {
							onViewChange(parsed.data)
						}
					}}
					data={translationsViewSchema.options.map((value) => ({ value, label: t(`translationsPage.view.${value}`) }))}
					className={classes.view}
				/>
				{view === 'COMPACT' && (
					<div className='flex items-center gap-2'>
						<Text component='span' aria-hidden fz='xs' c='var(--app-color-muted)'>
							{t('translationsPage.toolbar.sourceLanguage')}
						</Text>
						<LanguageSelect
							label={t('translationsPage.toolbar.sourceLanguage')}
							languages={languages}
							value={sourceLanguage}
							onChange={(tag) => onChange({ source: tag })}
						/>
						<ArrowRight aria-hidden className={classes.arrow} />
						<LanguageSelect
							label={t('translationsPage.toolbar.targetLanguage')}
							languages={languages}
							value={targetLanguage}
							onChange={(tag) => onChange({ target: tag })}
						/>
					</div>
				)}
			</div>
		</div>
	)
}

export default TranslationsToolbar
