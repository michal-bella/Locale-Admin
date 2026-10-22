import {
	type ComboboxItem,
	type ComboboxLikeRenderOptionInput,
	MultiSelect,
	Pill,
	SegmentedControl,
	Select,
	Switch,
	Tooltip,
	VisuallyHidden,
} from '@mantine/core'
import { useTranslation } from 'react-i18next'

import { type Language, LANGUAGE_TAGS, translationsLayoutSchema, translationsViewSchema } from '@locale/shared'

import { ArrowRight, Check, LayoutColumns, LayoutRows } from '@/components/Icons'
import LanguageFlag from '@/components/LanguageFlag/LanguageFlag'
import { findSupportedLanguage } from '@/lib/languageOptions'

import classes from './TranslationsViewControls.module.css'
import { type TranslationsViewControlsProps } from './types'

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
 * What the translations table shows, apart from the filters: the view and layout switches, source → target in the compact view or the shown languages
 * in the extended one, Zobraziť len zmeny (the diff against the previous version) and Len preklady, which hides the key and status columns.
 * Sits above the table card and scrolls away; only the filters stick.
 */
const TranslationsViewControls = ({
	view,
	onViewChange,
	isPreferenceSaving = false,
	layout,
	onLayoutChange,
	languages,
	sourceLanguage,
	targetLanguage,
	shownLanguages,
	translationsOnly,
	diffOnly,
	diffAvailable,
	onChange,
}: TranslationsViewControlsProps) => {
	const { t } = useTranslation()
	const filterLanguages = languages.filter((language) => !language.isBase)

	return (
		<div className={classes.root}>
			<div className={classes.modes}>
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
			</div>
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

export default TranslationsViewControls
