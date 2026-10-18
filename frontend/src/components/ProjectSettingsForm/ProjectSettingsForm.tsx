import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { ERROR_CODE, type ProjectSettings, toValidationCode, type UpdateProjectSettingsRequest, updateProjectSettingsRequestSchema } from '@locale/shared'

import getApiErrorCode from '@/api/getApiErrorCode'
import getApiErrorDetails from '@/api/getApiErrorDetails'
import { useUpdateProjectSettingsMutation } from '@/api/projectSettings/useUpdateProjectSettingsMutation'
import LeaveProjectModal from '@/components/LeaveProjectModal/LeaveProjectModal'
import ProjectBasicsSection from '@/components/ProjectBasicsSection/ProjectBasicsSection'
import VariableProtectionSection from '@/components/VariableProtectionSection/VariableProtectionSection'

import { type ProjectSettingsFormProps } from './types'

// Without languages there is no base language to send; the BE keeps the current one when the field is missing.
const toFormValues = ({ name, slug, primaryColor, protectVariables, baseLanguageId }: ProjectSettings): UpdateProjectSettingsRequest => ({
	name,
	slug,
	primaryColor,
	protectVariables,
	baseLanguageId: baseLanguageId ?? undefined,
})

/**
 * Project settings page body (Figma 3:1557), also used in the edit modal on Projekty. "Uložiť zmeny" saves the whole form;
 * "Opustiť projekt" asks for confirmation.
 */
const ProjectSettingsForm = ({ settings, languages, isMember, onLeft, onSaved, onCancel, focusFirstField = false }: ProjectSettingsFormProps) => {
	const { t } = useTranslation()
	const updateSettings = useUpdateProjectSettingsMutation(settings.id)
	const [leaveOpened, leaveModal] = useDisclosure(false)
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
				onSaved(saved)
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
				if (code === ERROR_CODE.SLUG_TAKEN) {
					setError('slug', { message: t('errors.SLUG_TAKEN') }, { shouldFocus: true })
					return
				}
				notifications.show({ color: 'red', message: t(`errors.${code}`) })
			},
		})
	})

	return (
		<form onSubmit={(event) => void onSubmit(event)} noValidate className='flex flex-col gap-5'>
			<ProjectBasicsSection
				register={register}
				control={control}
				errors={errors}
				languages={languages}
				savedColor={settings.primaryColor}
				projectSlug={settings.slug}
			/>
			<VariableProtectionSection control={control} />
			<div className='flex flex-wrap justify-between gap-3'>
				{isMember && (
					<Button variant='outline' onClick={leaveModal.open}>
						{t('projectSettingsPage.leave')}
					</Button>
				)}
				{!isMember && onCancel && (
					<Button variant='default' onClick={onCancel} disabled={isPending}>
						{t('projectSettingsPage.cancel')}
					</Button>
				)}
				<Button type='submit' loading={isPending} disabled={!isDirty} className='ml-auto'>
					{t('projectSettingsPage.save')}
				</Button>
			</div>
			<LeaveProjectModal opened={leaveOpened} project={settings} onClose={leaveModal.close} onLeft={onLeft} />
		</form>
	)
}

export default ProjectSettingsForm
