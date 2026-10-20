import { zodResolver } from '@hookform/resolvers/zod'
import { Button, MultiSelect, TextInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { type CreateProjectRequest, createProjectRequestSchema, ERROR_CODE, SUPPORTED_LANGUAGES, toValidationCode } from '@locale/shared'

import getApiErrorCode from '@/api/getApiErrorCode'
import getApiErrorDetails from '@/api/getApiErrorDetails'
import { useCreateProjectMutation } from '@/api/projects/useCreateProjectMutation'
import AppModal from '@/components/AppModal/AppModal'
import { ChevronDown } from '@/components/Icons'
import { getLanguageOptions, renderLanguageOption, renderLanguagePill } from '@/lib/languageOptions'
import { toSlug } from '@/lib/utils'

import { type CreateProjectModalProps } from './types'

/**
 * "Nový projekt": name, slug and languages. The slug follows the name until the user edits it; the first chosen language is the base.
 * On success opens the new project.
 */
const CreateProjectModal = ({ opened, onClose }: CreateProjectModalProps) => {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const createProject = useCreateProjectMutation()
	const { isPending } = createProject
	const [slugEdited, setSlugEdited] = useState(false)
	const {
		register,
		handleSubmit,
		setError,
		setValue,
		reset,
		control,
		formState: { errors },
	} = useForm({
		resolver: zodResolver(createProjectRequestSchema, {
			error: (issue) => {
				// zod passes a raw issue here; the fields toValidationCode reads (code, input, minimum, maximum, format) match the final issue.
				const { code, params } = toValidationCode(issue as Parameters<typeof toValidationCode>[0])
				return t(`validation.${code}`, params)
			},
		}),
		defaultValues: { name: '', slug: '', languageTags: [] },
	})

	const resetAndClose = () => {
		reset()
		setSlugEdited(false)
		createProject.reset()
		onClose()
	}

	const handleClose = () => {
		if (!isPending) {
			resetAndClose()
		}
	}

	const onSubmit = handleSubmit((values) => {
		if (isPending) {
			return
		}
		createProject.mutate(values, {
			onSuccess: (project) => {
				notifications.show({ color: 'green', message: t('projectsPage.createModal.success', { name: project.name }) })
				resetAndClose()
				void navigate({ to: '/projects/$projectSlug/settings', params: { projectSlug: project.slug } })
			},
			onError: (error) => {
				const code = getApiErrorCode(error)
				const details = getApiErrorDetails(error)
				if (code === ERROR_CODE.VALIDATION_ERROR && details.length > 0) {
					details.forEach(({ path, code: issueCode, params }, index) =>
						setError(path as keyof CreateProjectRequest, { message: t(`validation.${issueCode}`, params) }, { shouldFocus: index === 0 }),
					)
					return
				}
				if (code === ERROR_CODE.SLUG_TAKEN) {
					setError('slug', { message: t('errors.SLUG_TAKEN') }, { shouldFocus: true })
					return
				}
				notifications.show({ color: 'red', message: t(`errors.${code}`) })
			},
		})
	})

	return (
		<AppModal
			opened={opened}
			onClose={handleClose}
			title={t('projectsPage.createModal.title')}
			description={t('projectsPage.createModal.description')}
			closeLabel={t('projectsPage.createModal.close')}
			isPending={isPending}
			onSubmit={(event) => void onSubmit(event)}
			footer={
				<>
					<Button variant='default' onClick={handleClose} disabled={isPending}>
						{t('projectsPage.createModal.cancel')}
					</Button>
					<Button type='submit' loading={isPending}>
						{t('projectsPage.createModal.submit')}
					</Button>
				</>
			}
		>
			<TextInput
				data-autofocus
				autoComplete='off'
				label={t('projectsPage.createModal.name.label')}
				placeholder={t('projectsPage.createModal.name.placeholder')}
				error={errors.name?.message}
				{...register('name', {
					onChange: (event: { target: { value: string } }) => {
						if (!slugEdited) {
							setValue('slug', toSlug(event.target.value))
						}
					},
				})}
			/>
			<TextInput
				autoComplete='off'
				label={t('projectsPage.createModal.slug.label')}
				description={t('projectsPage.createModal.slug.hint')}
				placeholder={t('projectsPage.createModal.slug.placeholder')}
				inputWrapperOrder={['label', 'input', 'description', 'error']}
				error={errors.slug?.message}
				{...register('slug', { onChange: () => setSlugEdited(true) })}
			/>
			<Controller
				control={control}
				name='languageTags'
				render={({ field }) => {
					const allSelected = field.value.length === SUPPORTED_LANGUAGES.length
					// Already picked tags keep their order, so the base language (the first one) does not change.
					const selectAll = () =>
						field.onChange([...field.value, ...SUPPORTED_LANGUAGES.map(({ tag }) => tag).filter((tag) => !field.value.includes(tag))])
					return (
						<div className='relative'>
							<MultiSelect
								ref={field.ref}
								searchable
								hidePickedOptions
								// Enter after typing picks the first match instead of submitting the form.
								selectFirstOptionOnChange
								label={t('projectsPage.createModal.languages.label')}
								description={t('projectsPage.createModal.languages.hint')}
								placeholder={field.value.length === 0 ? t('projectsPage.createModal.languages.placeholder') : undefined}
								nothingFoundMessage={t('languagesPage.addModal.language.nothingFound')}
								inputWrapperOrder={['label', 'input', 'description', 'error']}
								data={getLanguageOptions()}
								renderOption={renderLanguageOption}
								renderPill={renderLanguagePill}
								// Mantine's clear button is mouse-only (aria-hidden); keyboard users have Zrušiť výber below.
								clearable
								value={field.value}
								onChange={field.onChange}
								onBlur={field.onBlur}
								error={errors.languageTags?.message}
								rightSection={<ChevronDown aria-hidden />}
							/>
							{/* After the select in the DOM, so Tab reaches the field first; placed on the label line. */}
							<Button
								variant='subtle'
								size='compact-xs'
								className='absolute top-0 right-0'
								aria-label={t(
									allSelected ? 'projectsPage.createModal.languages.clearAllLabel' : 'projectsPage.createModal.languages.selectAllLabel',
								)}
								onClick={allSelected ? () => field.onChange([]) : selectAll}
							>
								{t(allSelected ? 'projectsPage.createModal.languages.clearAll' : 'projectsPage.createModal.languages.selectAll')}
							</Button>
						</div>
					)
				}}
			/>
		</AppModal>
	)
}

export default CreateProjectModal
