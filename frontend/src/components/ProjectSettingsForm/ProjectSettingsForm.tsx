import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Tooltip } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { ERROR_CODE, type ProjectSettings, toValidationCode, type UpdateProjectSettingsRequest, updateProjectSettingsRequestSchema } from '@locale/shared'

import getApiErrorCode from '@/api/getApiErrorCode'
import getApiErrorDetails from '@/api/getApiErrorDetails'
import { useUpdateProjectSettingsMutation } from '@/api/projectSettings/useUpdateProjectSettingsMutation'
import ProjectBasicsSection from '@/components/ProjectBasicsSection/ProjectBasicsSection'
import VariableProtectionSection from '@/components/VariableProtectionSection/VariableProtectionSection'

import { type ProjectSettingsFormProps } from './types'

// Without languages `baseLanguageId` is null; the empty string fails the schema, so the form cannot be saved until a language exists.
const toFormValues = ({ name, slug, primaryColor, protectVariables, baseLanguageId }: ProjectSettings): UpdateProjectSettingsRequest => ({
	name,
	slug,
	primaryColor,
	protectVariables,
	baseLanguageId: baseLanguageId ?? '',
})

/** Project settings page body (Figma 3:1557). "Uložiť zmeny" saves the whole form; "Opustiť projekt" waits for project members. */
const ProjectSettingsForm = ({ settings, languages, focusFirstField = false }: ProjectSettingsFormProps) => {
	const { t } = useTranslation()
	const updateSettings = useUpdateProjectSettingsMutation()
	const { isPending } = updateSettings
	const {
		register,
		control,
		handleSubmit,
		setError,
		setFocus,
		reset,
		formState: { errors, isDirty },
	} = useForm({
		resolver: zodResolver(updateProjectSettingsRequestSchema, {
			error: (issue) => {
				// zod passes a raw issue here; the fields toValidationCode reads (code, input, minimum, maximum, format) match the final issue.
				const { code, params } = toValidationCode(issue as Parameters<typeof toValidationCode>[0])
				return t(`validation.${code}`, params)
			},
		}),
		defaultValues: toFormValues(settings),
	})

	useEffect(() => {
		if (focusFirstField) {
			setFocus('name')
		}
	}, [focusFirstField, setFocus])

	const onSubmit = handleSubmit((values) => {
		if (isPending) {
			return
		}
		updateSettings.mutate(values, {
			onSuccess: (saved) => {
				notifications.show({ color: 'green', message: t('projectSettingsPage.saveSuccess') })
				reset(toFormValues(saved))
			},
			onError: (error) => {
				const code = getApiErrorCode(error)
				const details = getApiErrorDetails(error)
				if (code === ERROR_CODE.VALIDATION_ERROR && details.length > 0) {
					details.forEach(({ path, code: issueCode, params }, index) =>
						setError(path as keyof UpdateProjectSettingsRequest, { message: t(`validation.${issueCode}`, params) }, { shouldFocus: index === 0 }),
					)
					return
				}
				notifications.show({ color: 'red', message: t(`errors.${code}`) })
			},
		})
	})

	return (
		<form onSubmit={(event) => void onSubmit(event)} noValidate className='flex flex-col gap-5'>
			<ProjectBasicsSection register={register} control={control} errors={errors} languages={languages} savedColor={settings.primaryColor} />
			<VariableProtectionSection control={control} />
			<div className='flex flex-wrap justify-between gap-3'>
				{/* Mantine: a `disabled` button fires no mouseleave, so the tooltip needs `data-disabled` and a prevented click. */}
				<Tooltip label={t('projectSettingsPage.leaveTooltip')} events={{ hover: true, focus: true, touch: true }}>
					<Button variant='outline' data-disabled aria-disabled='true' onClick={(event) => event.preventDefault()}>
						{t('projectSettingsPage.leave')}
					</Button>
				</Tooltip>
				<Button type='submit' loading={isPending} disabled={!isDirty}>
					{t('projectSettingsPage.save')}
				</Button>
			</div>
		</form>
	)
}

export default ProjectSettingsForm
