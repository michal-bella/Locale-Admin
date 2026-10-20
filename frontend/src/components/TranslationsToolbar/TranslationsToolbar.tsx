import {
	CloseButton,
	type ComboboxItem,
	type ComboboxLikeRenderOptionInput,
	MultiSelect,
	Pill,
	SegmentedControl,
	Select,
	Switch,
	TextInput,
	Tooltip,
	VisuallyHidden,
} from '@mantine/core'
import { useDebouncedCallback } from '@mantine/hooks'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
	type Language,
	LANGUAGE_TAGS,
	TRANSLATIONS_SEARCH_MAX_LENGTH,
	translationsLayoutSchema,
	translationsSortSchema,
	translationStatusSchema,
	translationsUpdatedWithinSchema,
	translationsViewSchema,
} from '@locale/shared'

import { ArrowRight, Check, LayoutColumns, LayoutRows, Search } from '@/components/Icons'
import LanguageFlag from '@/components/LanguageFlag/LanguageFlag'
import TranslationStatusBadge from '@/components/TranslationStatusBadge/TranslationStatusBadge'
import { findSupportedLanguage } from '@/lib/languageOptions'

import classes from './TranslationsToolbar.module.css'
import { type TranslationsToolbarProps } from './types'

const SEARCH_DEBOUNCE_MS = 300

const ALL_STATUSES = 'ALL' as const

const LAYOUT_ICONS = { COLUMNS: LayoutColumns, STACKED: LayoutRows }

/** The pair selects label an option with the tag and hint the name; the language filter labels it with the name. */
const renderLanguageOption = ({ option, checked }: ComboboxLikeRenderOptionInput<ComboboxItem & { hint?: string }>) => {
	const language = findSupportedLanguage(option.value)
	return (
		<span className='flex w-full items-center gap-2'>
			{language && <LanguageFlag code={language.flagCode} size='sm' />}
			<span className='font-semibold'>{option.label}</span>
			{option.hint && <span className={classes.optionHint}>{option.hint}</span>}
			{checked && <Check aria-hidden className={classes.optionCheck} />}
		</span>
	)
}

const renderStatusOption = ({ option }: ComboboxLikeRenderOptionInput<ComboboxItem>) => {
	const parsed = translationStatusSchema.safeParse(option.value)
	return parsed.success ? <TranslationStatusBadge status={parsed.data} /> : option.label
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
}) => {
	const { t } = useTranslation()
	return (
		<Select
			aria-label={label}
			className={classes.languageSelect}
			data={languages.map((language) => ({ value: language.tag, label: language.tag.toUpperCase(), hint: t(`languageNames.${language.tag}`) }))}
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
			leftSectionWidth={36}
			rightSectionWidth={28}
			comboboxProps={{ width: 220, position: 'bottom-end' }}
			withScrollArea={false}
		/>
	)
}

/**
 * Filters above the translations table (Figma 3:121): search, status, namespace, sort, the view and layout switches and, in the compact view,
 * source → target language. Len preklady hides the key and status columns. A second row holds status, namespace, sort, Editor and Zmenené. The search writes
 * to the URL 300 ms after the last keystroke; the X and Esc clear it right away, as the other filters do.
 */
const TranslationsToolbar = ({
	search,
	status,
	namespace,
	sort,
	view,
	onViewChange,
	isPreferenceSaving = false,
	layout,
	onLayoutChange,
	languages,
	sourceLanguage,
	targetLanguage,
	shownLanguages,
	updatedBy,
	updatedWithin,
	translationsOnly,
	editors,
	namespaces,
	onChange,
}: TranslationsToolbarProps) => {
	const { t } = useTranslation()
	const [searchValue, setSearchValue] = useState(search ?? '')
	const [committedSearch, setCommittedSearch] = useState(search)
	const commitSearch = useDebouncedCallback((value: string) => onChange({ search: value.trim() || undefined }), SEARCH_DEBOUNCE_MS)
	const searchRef = useRef<HTMLInputElement>(null)

	const clearSearch = () => {
		commitSearch.cancel()
		setSearchValue('')
		onChange({ search: undefined })
		searchRef.current?.focus()
	}

	// The URL changed without typing (Zrušiť filtre, back button), so the field shows the URL value.
	if (search !== committedSearch) {
		setCommittedSearch(search)
		if ((search ?? '') !== searchValue.trim()) {
			setSearchValue(search ?? '')
		}
	}

	const namespaceOptions = namespaces.filter(Boolean)
	const filterLanguages = languages.filter((language) => !language.isBase)

	return (
		<div className='flex flex-col gap-2'>
			{/* The search leads the first row and takes what the view, layout, languages and Len preklady leave of it. */}
			<div className='flex flex-wrap items-center gap-2'>
				<TextInput
					aria-label={t('translationsPage.toolbar.search.label')}
					placeholder={t('translationsPage.toolbar.search.placeholder')}
					ref={searchRef}
					leftSection={<Search aria-hidden />}
					rightSection={searchValue && <CloseButton size='sm' aria-label={t('translationsPage.toolbar.search.clear')} onClick={clearSearch} />}
					maxLength={TRANSLATIONS_SEARCH_MAX_LENGTH}
					className={classes.search}
					value={searchValue}
					onChange={(event) => {
						setSearchValue(event.currentTarget.value)
						commitSearch(event.currentTarget.value)
					}}
					onKeyDown={(event) => {
						if (event.key === 'Escape' && searchValue) {
							clearSearch()
						}
					}}
				/>
				<SegmentedControl
					aria-label={t('translationsPage.view.label')}
					value={view}
					readOnly={isPreferenceSaving}
					onChange={(value) => {
						const parsed = translationsViewSchema.safeParse(value)
						if (parsed.success) {
							onViewChange(parsed.data)
						}
					}}
					data={translationsViewSchema.options.map((value) => ({ value, label: t(`translationsPage.view.${value}`) }))}
					radius='lg'
					classNames={{ root: classes.view, label: classes.viewLabel }}
				/>
				<SegmentedControl
					aria-label={t('translationsPage.layout.label')}
					value={layout}
					readOnly={isPreferenceSaving}
					onChange={(value) => {
						const parsed = translationsLayoutSchema.safeParse(value)
						if (parsed.success) {
							onLayoutChange(parsed.data)
						}
					}}
					data={translationsLayoutSchema.options.map((value) => {
						const Icon = LAYOUT_ICONS[value]
						return {
							value,
							label: (
								<Tooltip label={t(`translationsPage.layout.${value}`)}>
									<span className={classes.layoutLabel}>
										<Icon aria-hidden />
										<VisuallyHidden>{t(`translationsPage.layout.${value}`)}</VisuallyHidden>
									</span>
								</Tooltip>
							),
						}
					})}
					radius='lg'
					classNames={{ root: classes.layout, label: classes.viewLabel }}
				/>
				{view === 'COMPACT' && (
					<div className='flex items-center gap-2 max-sm:w-full'>
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
				{view === 'EXTENDED' && filterLanguages.length > 1 && (
					<MultiSelect
						aria-label={t('translationsPage.toolbar.languages.label')}
						placeholder={shownLanguages ? undefined : t('translationsPage.toolbar.languages.placeholder')}
						className={classes.languages}
						classNames={{ inputField: classes.languagesField }}
						data={filterLanguages.map((language) => ({ value: language.tag, label: t(`languageNames.${language.tag}`) }))}
						value={shownLanguages ?? []}
						onChange={(values) => {
							const tags = LANGUAGE_TAGS.filter((tag) => values.includes(tag))
							onChange({ languages: tags.length > 0 ? tags : undefined })
						}}
						renderOption={renderLanguageOption}
						// A short tag per pill keeps several languages on one line; the remove button names the language.
						renderPill={({ option, onRemove }) => {
							const language = findSupportedLanguage(String(option.value))
							return (
								<Pill
									withRemoveButton
									onRemove={onRemove}
									removeButtonProps={{ 'aria-label': t('translationsPage.toolbar.languages.remove', { language: option.label }) }}
									classNames={{ root: classes.languagePill, label: classes.languagePillLabel }}
								>
									{language && <LanguageFlag code={language.flagCode} size='sm' />}
									{String(option.value).toUpperCase()}
								</Pill>
							)
						}}
						hidePickedOptions={false}
						withScrollArea={false}
						comboboxProps={{ width: 260, position: 'bottom-start' }}
					/>
				)}
				<Switch
					label={t('translationsPage.toolbar.translationsOnly')}
					checked={translationsOnly === true}
					onChange={(event) => onChange({ translationsOnly: event.currentTarget.checked || undefined })}
					className={classes.switch}
					classNames={{ track: classes.pointer, label: classes.pointer }}
				/>
			</div>
			{/* The filters grow to fill their rows, so no row ends in a blank gap however it wraps. */}
			<div className={classes.filters}>
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
					renderOption={renderStatusOption}
					leftSection={status && <TranslationStatusBadge status={status} />}
					leftSectionWidth={status ? 'auto' : undefined}
					leftSectionProps={{ className: status ? classes.statusBadgeSection : undefined }}
					classNames={{ input: status ? classes.statusInputWithBadge : undefined }}
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
				{(editors.length > 0 || updatedBy !== undefined) && (
					<Select
						aria-label={t('translationsPage.toolbar.updatedBy.label')}
						placeholder={t('translationsPage.toolbar.updatedBy.placeholder')}
						className={classes.select}
						data={editors.map((editor) => ({ value: editor.id, label: editor.name }))}
						value={updatedBy ?? null}
						onChange={(value) => onChange({ updatedBy: value ?? undefined })}
						searchable
						clearable
					/>
				)}
				<Select
					aria-label={t('translationsPage.toolbar.updatedWithin.label')}
					placeholder={t('translationsPage.toolbar.updatedWithin.placeholder')}
					className={classes.select}
					data={translationsUpdatedWithinSchema.options.map((value) => ({ value, label: t(`translationsPage.toolbar.updatedWithin.${value}`) }))}
					value={updatedWithin ?? null}
					onChange={(value) => {
						const parsed = translationsUpdatedWithinSchema.safeParse(value)
						onChange({ updatedWithin: parsed.success ? parsed.data : undefined })
					}}
					clearable
					withScrollArea={false}
				/>
			</div>
		</div>
	)
}

export default TranslationsToolbar
