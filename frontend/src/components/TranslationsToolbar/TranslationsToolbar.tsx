import { CloseButton, type ComboboxItem, type ComboboxLikeRenderOptionInput, Select, TextInput } from '@mantine/core'
import { useDebouncedCallback } from '@mantine/hooks'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { TRANSLATIONS_SEARCH_MAX_LENGTH, translationsSortSchema, translationStatusSchema, translationsUpdatedWithinSchema } from '@locale/shared'

import { Search } from '@/components/Icons'
import TranslationStatusBadge from '@/components/TranslationStatusBadge/TranslationStatusBadge'

import classes from './TranslationsToolbar.module.css'
import { type TranslationsToolbarProps } from './types'

const SEARCH_DEBOUNCE_MS = 300

const ALL_STATUSES = 'ALL' as const

const renderStatusOption = ({ option }: ComboboxLikeRenderOptionInput<ComboboxItem>) => {
	const parsed = translationStatusSchema.safeParse(option.value)
	return parsed.success ? <TranslationStatusBadge status={parsed.data} /> : option.label
}

/**
 * Filters of the translations table (Figma 3:121): search, status, namespace, sort, Editor, Zmenené and Verzia. What the table shows (view, layout, languages,
 * Len preklady) lives in `TranslationsViewControls`. The search writes to the URL 300 ms after the last keystroke; the X and Esc clear it right away,
 * as the other filters do.
 */
const TranslationsToolbar = ({
	search,
	status,
	namespace,
	sort,
	updatedBy,
	updatedWithin,
	version,
	versions,
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

	return (
		// The search and the filters grow to fill their rows, so no row ends in a blank gap however it wraps.
		<div className={classes.filters}>
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
				// Select only defaults the right section to `none`; without this a click on the badge never reaches the input.
				leftSectionPointerEvents='none'
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
			{(versions.length > 0 || version !== undefined) && (
				<Select
					aria-label={t('translationsPage.toolbar.version.label')}
					placeholder={t('translationsPage.toolbar.version.placeholder')}
					className={classes.select}
					data={versions.map((item) => ({
						value: item.id,
						label: item.isCurrent ? t('translationsPage.toolbar.version.current', { name: item.name }) : item.name,
					}))}
					value={version ?? null}
					onChange={(value) => onChange({ version: value ?? undefined })}
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
	)
}

export default TranslationsToolbar
