import { ColorInput, Select, type SelectProps, TextInput } from '@mantine/core'
import { Link } from '@tanstack/react-router'
import { useId } from 'react'
import { Controller, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { hexColorSchema } from '@locale/shared'

import { ChevronDown } from '@/components/Icons'
import LanguageFlag from '@/components/LanguageFlag/LanguageFlag'
import ProfileSection from '@/components/ProfileSection/ProfileSection'
import { isLightColor } from '@/lib/utils'

import classes from './ProjectBasicsSection.module.css'
import { type ProjectBasicsSectionProps } from './types'

/** "Základné údaje" (Figma 3:1600) with the base language row added under the primary color. */
const ProjectBasicsSection = ({ register, control, errors, languages, savedColor }: ProjectBasicsSectionProps) => {
	const { t } = useTranslation()
	const nameId = useId()
	const slugId = useId()
	const colorId = useId()
	const baseLanguageId = useId()
	const typedColor = useWatch({ control, name: 'primaryColor' })
	const previewColor = hexColorSchema.safeParse(typedColor).data ?? savedColor
	const hasLanguages = languages.length > 0

	const languageOptions = languages.map(({ id, englishName, tag }) => ({ value: id, label: `${englishName} (${tag})` }))

	const renderLanguageOption: SelectProps['renderOption'] = ({ option }) => {
		const language = languages.find(({ id }) => id === option.value)
		return (
			<span className='flex items-center gap-2'>
				{language && <LanguageFlag code={language.flagCode} size='sm' />}
				{option.label}
			</span>
		)
	}

	return (
		<ProfileSection title={t('projectSettingsPage.basics.title')} description={t('projectSettingsPage.basics.description')}>
			<div className={`${classes.grid} grid gap-x-6 gap-y-5`}>
				<label htmlFor={nameId} className={`${classes.label} pt-3`}>
					{t('projectSettingsPage.basics.name')}
				</label>
				<TextInput id={nameId} error={errors.name?.message} {...register('name')} />

				<label htmlFor={slugId} className={`${classes.label} pt-3`}>
					{t('projectSettingsPage.basics.slug.label')}
				</label>
				<TextInput
					id={slugId}
					description={t('projectSettingsPage.basics.slug.description')}
					inputWrapperOrder={['input', 'description', 'error']}
					classNames={{ description: `${classes.hint} pt-1.5` }}
					error={errors.slug?.message}
					{...register('slug')}
				/>

				<label htmlFor={colorId} className={`${classes.label} pt-3`}>
					{t('projectSettingsPage.basics.primaryColor.label')}
				</label>
				<div className='flex flex-wrap items-start gap-3'>
					<Controller
						control={control}
						name='primaryColor'
						render={({ field }) => (
							<ColorInput
								ref={field.ref}
								id={colorId}
								className={classes.colorInput}
								format='hex'
								withEyeDropper={false}
								fixOnBlur={false}
								value={field.value}
								onChange={field.onChange}
								onBlur={field.onBlur}
								error={errors.primaryColor?.message}
							/>
						)}
					/>
					<span
						data-tone={isLightColor(previewColor) ? 'dark' : 'light'}
						className={`${classes.preview} mt-1.5`}
						style={{ backgroundColor: previewColor }}
					>
						{t('projectSettingsPage.basics.primaryColor.preview')}
					</span>
				</div>

				<label htmlFor={baseLanguageId} className={`${classes.label} pt-3`}>
					{t('projectSettingsPage.basics.baseLanguage.label')}
				</label>
				<Controller
					control={control}
					name='baseLanguageId'
					render={({ field }) => {
						const selected = languages.find(({ id }) => id === field.value)
						return (
							<Select
								ref={field.ref}
								id={baseLanguageId}
								className={classes.select}
								data={languageOptions}
								value={field.value || null}
								onChange={(value) => value && field.onChange(value)}
								onBlur={field.onBlur}
								allowDeselect={false}
								disabled={!hasLanguages}
								placeholder={t('projectSettingsPage.basics.baseLanguage.placeholder')}
								description={
									!hasLanguages && (
										<>
											{t('projectSettingsPage.basics.baseLanguage.empty')}{' '}
											<Link to='/languages' className={classes.link}>
												{t('projectSettingsPage.basics.baseLanguage.emptyLink')}
											</Link>
										</>
									)
								}
								inputWrapperOrder={['input', 'description', 'error']}
								classNames={{ description: `${classes.hint} pt-1.5` }}
								error={errors.baseLanguageId?.message}
								renderOption={renderLanguageOption}
								leftSection={selected && <LanguageFlag code={selected.flagCode} size='sm' />}
								rightSection={<ChevronDown aria-hidden />}
								rightSectionPointerEvents='none'
							/>
						)
					}}
				/>
			</div>
		</ProfileSection>
	)
}

export default ProjectBasicsSection
