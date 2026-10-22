import { zodResolver } from '@hookform/resolvers/zod'
import { Button, TextInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import {
	type CreateProjectVersionRequest,
	createProjectVersionRequestSchema,
	ERROR_CODE,
	PROJECT_VERSION_NAME_MAX_LENGTH,
	VALIDATION_CODE,
	toValidationCode,
} from '@locale/shared'

import getApiErrorCode from '@/api/getApiErrorCode'
import getApiErrorDetails from '@/api/getApiErrorDetails'
import { useCreateProjectVersionMutation } from '@/api/projectVersions/useCreateProjectVersionMutation'
import { useUpdateProjectVersionMutation } from '@/api/projectVersions/useUpdateProjectVersionMutation'
import { QUERY_KEYS } from '@/api/queryKeys'
import AppModal from '@/components/AppModal/AppModal'

import { type VersionFormModalProps } from './types'

const EMPTY_VALUES: CreateProjectVersionRequest = { name: '', startsAt: '', endsAt: '' }

/**
 * "Vytvoriť verziu" and "Upraviť verziu" of a project: name matching the code release and the two dates (native date inputs, the
 * contract's `YYYY-MM-DD`). The edit sends every field; the lock is changed from the table, not here.
 */
const VersionFormModal = ({ projectId, opened, version, onClose }: VersionFormModalProps) => {
	const { t } = useTranslation()
	const queryClient = useQueryClient()
	const createVersion = useCreateProjectVersionMutation(projectId)
	const updateVersion = useUpdateProjectVersionMutation(projectId)
	const isPending = createVersion.isPending || updateVersion.isPending
	const mode = version ? 'edit' : 'create'
	const {
		register,
		handleSubmit,
		setError,
		reset,
		formState: { errors },
	} = useForm({
		resolver: zodResolver(createProjectVersionRequestSchema, {
			error: (issue) => {
				if (issue.code === 'custom' && issue.path?.[0] === 'endsAt') {
					return t('versionsPage.form.endsAt.afterStart')
				}
				// An empty native date input is '' and fails the format check; it is a missing field, not a malformed date.
				if (issue.code === 'invalid_format' && issue.input === '') {
					return t('validation.REQUIRED')
				}
				// zod passes a raw issue here; the fields toValidationCode reads (code, input, minimum, maximum, format) match the final issue.
				const { code, params } = toValidationCode(issue as Parameters<typeof toValidationCode>[0])
				return t(`validation.${code}`, params)
			},
		}),
		defaultValues: EMPTY_VALUES,
	})

	// The same modal edits different versions; the fields follow the one it was opened for.
	useEffect(() => {
		if (opened) {
			reset(version ? { name: version.name, startsAt: version.startsAt, endsAt: version.endsAt } : EMPTY_VALUES)
		}
	}, [opened, version, reset])

	const resetAndClose = () => {
		reset(EMPTY_VALUES)
		createVersion.reset()
		updateVersion.reset()
		onClose()
	}

	const handleClose = () => {
		if (!isPending) {
			resetAndClose()
		}
	}

	const handleError = (error: unknown) => {
		const code = getApiErrorCode(error)
		const details = getApiErrorDetails(error)
		if (code === ERROR_CODE.VALIDATION_ERROR && details.length > 0) {
			details.forEach(({ path, code: issueCode, params }, index) =>
				setError(
					path as keyof CreateProjectVersionRequest,
					{
						message:
							path === 'endsAt' && issueCode === VALIDATION_CODE.INVALID
								? t('versionsPage.form.endsAt.afterStart')
								: t(`validation.${issueCode}`, params),
					},
					{ shouldFocus: index === 0 },
				),
			)
			return
		}
		if (code === ERROR_CODE.PROJECT_VERSION_NAME_TAKEN) {
			setError('name', { message: t('errors.PROJECT_VERSION_NAME_TAKEN') }, { shouldFocus: true })
			return
		}
		notifications.show({ color: 'red', message: t(`errors.${code}`) })
		// The version is gone from this project; the list drops the row.
		if (code === ERROR_CODE.PROJECT_VERSION_NOT_FOUND) {
			void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PROJECTS.VERSIONS(projectId) })
			resetAndClose()
		}
	}

	const onSubmit = handleSubmit((values) => {
		if (isPending) {
			return
		}
		if (version) {
			updateVersion.mutate(
				{ versionId: version.id, ...values },
				{
					onSuccess: (updated) => {
						notifications.show({ color: 'green', message: t('versionsPage.form.editSuccess', { name: updated.name }) })
						resetAndClose()
					},
					onError: handleError,
				},
			)
			return
		}
		createVersion.mutate(values, {
			onSuccess: (created) => {
				notifications.show({ color: 'green', message: t('versionsPage.form.createSuccess', { name: created.name }) })
				resetAndClose()
			},
			onError: handleError,
		})
	})

	return (
		<AppModal
			opened={opened}
			onClose={handleClose}
			title={t(`versionsPage.form.title.${mode}`)}
			description={t('versionsPage.form.description')}
			closeLabel={t('versionsPage.form.close')}
			isPending={isPending}
			onSubmit={(event) => void onSubmit(event)}
			footer={
				<>
					<Button variant='default' onClick={handleClose} disabled={isPending}>
						{t('versionsPage.form.cancel')}
					</Button>
					<Button type='submit' loading={isPending}>
						{t(`versionsPage.form.submit.${mode}`)}
					</Button>
				</>
			}
		>
			<div className='flex flex-col gap-4'>
				<TextInput
					data-autofocus
					autoComplete='off'
					maxLength={PROJECT_VERSION_NAME_MAX_LENGTH}
					label={t('versionsPage.form.name.label')}
					placeholder={t('versionsPage.form.name.placeholder')}
					description={t('versionsPage.form.name.description')}
					error={errors.name?.message}
					{...register('name')}
				/>
				<div className='flex flex-col gap-4 sm:flex-row'>
					<TextInput
						type='date'
						className='flex-1'
						label={t('versionsPage.form.startsAt.label')}
						description={t('versionsPage.form.startsAt.description')}
						error={errors.startsAt?.message}
						{...register('startsAt')}
					/>
					<TextInput
						type='date'
						className='flex-1'
						label={t('versionsPage.form.endsAt.label')}
						description={t('versionsPage.form.endsAt.description')}
						error={errors.endsAt?.message}
						{...register('endsAt')}
					/>
				</div>
			</div>
		</AppModal>
	)
}

export default VersionFormModal
