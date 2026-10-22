import { CloseButton, type ComboboxItem, type ComboboxLikeRenderOptionInput, Select, Switch, TextInput } from '@mantine/core'
import { useDebouncedCallback } from '@mantine/hooks'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { TRANSLATIONS_SEARCH_MAX_LENGTH, translationsSortSchema, translationStatusSchema, translationsUpdatedWithinSchema } from '@locale/shared'

import { ArrowsSort, CheckCircle, Clock, Folder, Search, Tag, User } from '@/components/Icons'
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
 * Filters of the translations table (Figma 3:121): search, sort, Verzia, status, namespace, Editor and Zmenené, each with an icon in the left
 * section so the row of selects reads apart, then the switches Zobraziť len zmeny and Len preklady. How the table is laid out (view, layout,
 * languages) lives in `TranslationsViewControls`. The search writes to the URL 300 ms after the last keystroke; the X and Esc clear it right away,
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
	translationsOnly,
	diffOnly,
	diffAvailable,
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
		// The search grows to fill its row; the selects grow only up to a cap, so a wrapped row keeps them at their size and the switches at its end.
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
				aria-label={t('translationsPage.toolbar.sort.label')}
				className={classes.select}
				leftSection={<ArrowsSort aria-hidden />}
				data={translationsSortSchema.options.map((value) => ({ value, label: t(`translationsPage.toolbar.sort.${value}`) }))}
				value={sort}
				onChange={(value) => {
					const parsed = translationsSortSchema.safeParse(value)
					onChange({ sort: parsed.success && parsed.data !== 'UNTRANSLATED_FIRST' ? parsed.data : undefined })
				}}
				allowDeselect={false}
				withScrollArea={false}
			/>
			{versions.length > 0 && (
				<Select
					aria-label={t('translationsPage.toolbar.version.label')}
					placeholder={t('translationsPage.toolbar.version.placeholder')}
					className={classes.select}
					leftSection={<Tag width={16} height={16} aria-hidden />}
					data={versions.map((item) => ({
						value: item.id,
						label: item.isCurrent ? t('translationsPage.toolbar.version.current', { name: item.name }) : item.name,
					}))}
					value={version ?? null}
					// No clear button: the list always shows one version.
					onChange={(value) => onChange({ version: value ?? undefined })}
					allowDeselect={false}
				/>
			)}
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
				leftSection={
					<>
						<CheckCircle aria-hidden />
						{status && <TranslationStatusBadge status={status} />}
					</>
				}
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
					leftSection={<Folder aria-hidden />}
					data={namespaceOptions}
					value={namespace ?? null}
					onChange={(value) => onChange({ namespace: value ?? undefined })}
					clearable
				/>
			)}
			{(editors.length > 0 || updatedBy !== undefined) && (
				<Select
					aria-label={t('translationsPage.toolbar.updatedBy.label')}
					placeholder={t('translationsPage.toolbar.updatedBy.placeholder')}
					className={classes.select}
					leftSection={<User aria-hidden />}
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
				leftSection={<Clock aria-hidden />}
				data={translationsUpdatedWithinSchema.options.map((value) => ({ value, label: t(`translationsPage.toolbar.updatedWithin.${value}`) }))}
				value={updatedWithin ?? null}
				onChange={(value) => {
					const parsed = translationsUpdatedWithinSchema.safeParse(value)
					onChange({ updatedWithin: parsed.success ? parsed.data : undefined })
				}}
				clearable
				withScrollArea={false}
			/>
			<div className={classes.switches}>
				{diffAvailable && (
					<Switch
						label={t('translationsPage.view.diffOnly')}
						checked={diffOnly === true}
						onChange={(event) => onChange({ diff: event.currentTarget.checked || undefined })}
						className={classes.switch}
						classNames={{ track: classes.pointer, label: classes.pointer }}
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
		</div>
	)
}

export default TranslationsToolbar
