import { zodResolver } from '@hookform/resolvers/zod'
import { Button, type InputWrapperProps, TextInput } from '@mantine/core'
import { DateInput, DatesProvider } from '@mantine/dates'
import { notifications } from '@mantine/notifications'
import { useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
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
import { parseDateInput, toDayjsLocale } from '@/lib/dateInput'
import { formatDate } from '@/lib/formatDate'

import classes from './VersionFormModal.module.css'
import { type VersionFormModalProps } from './types'

const EMPTY_VALUES: CreateProjectVersionRequest = { name: '', startsAt: '', endsAt: '' }

const DATE_FIELDS = ['startsAt', 'endsAt'] as const

/** The input sits right under the label on both fields, so a longer description does not push one of them down. */
const DATE_WRAPPER_ORDER: NonNullable<InputWrapperProps['inputWrapperOrder']> = ['label', 'input', 'description', 'error']

/**
 * "Vytvoriť verziu" and "Upraviť verziu" of a project: name matching the code release and the two dates (Mantine `DateInput`, typed or
 * picked from the calendar, held as the contract's `YYYY-MM-DD`). The edit sends every field; the lock is changed from the table, not here.
 */
const VersionFormModal = ({ projectId, opened, version, onClose, onCreated, zIndex }: VersionFormModalProps) => {
	const { t, i18n } = useTranslation()
	const queryClient = useQueryClient()
	const createVersion = useCreateProjectVersionMutation(projectId)
	const updateVersion = useUpdateProjectVersionMutation(projectId)
	const isPending = createVersion.isPending || updateVersion.isPending
	const mode = version ? 'edit' : 'create'
	const datePresets = [{ value: dayjs().format('YYYY-MM-DD'), label: t('versionsPage.form.today') }]
	const {
		register,
		control,
		handleSubmit,
		setError,
		reset,
		formState: { errors, isDirty },
	} = useForm({
		resolver: zodResolver(createProjectVersionRequestSchema, {
			error: (issue) => {
				if (issue.code === 'custom' && issue.path?.[0] === 'endsAt') {
					return t('versionsPage.form.endsAt.afterStart')
				}
				// An empty date field is '' and fails the format check; it is a missing field, not a malformed date.
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
				onCreated?.(created)
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
			zIndex={zIndex}
			onSubmit={(event) => void onSubmit(event)}
			footer={
				<>
					<Button variant='default' onClick={handleClose} disabled={isPending}>
						{t('versionsPage.form.cancel')}
					</Button>
					<Button type='submit' loading={isPending} disabled={mode === 'edit' && !isDirty}>
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
				<DatesProvider settings={{ locale: toDayjsLocale(i18n.language) }}>
					<div className='flex flex-col gap-4 sm:flex-row'>
						{DATE_FIELDS.map((name) => (
							<Controller
								key={name}
								name={name}
								control={control}
								render={({ field, fieldState }) => (
									<DateInput
										ref={field.ref}
										name={field.name}
										className='flex-1'
										label={t(`versionsPage.form.${name}.label`)}
										description={t(`versionsPage.form.${name}.description`)}
										placeholder={t('versionsPage.form.datePlaceholder')}
										inputWrapperOrder={DATE_WRAPPER_ORDER}
										value={field.value || null}
										onChange={(value) => field.onChange(value ?? '')}
										onBlur={field.onBlur}
										error={fieldState.error?.message}
										valueFormat={(value) => formatDate(value, i18n.language)}
										dateParser={parseDateInput}
										clearable
										highlightToday
										presets={datePresets}
										disabled={isPending}
										popoverProps={{ classNames: { dropdown: classes.dropdown } }}
										classNames={{
											calendarHeaderLevel: classes.calendarHeaderLevel,
											calendarHeaderControl: classes.calendarHeaderControl,
											weekday: classes.weekday,
											day: classes.day,
											monthsListControl: classes.monthsListControl,
											yearsListControl: classes.yearsListControl,
											presetsRoot: classes.presetsRoot,
											presetsList: classes.presetsList,
											presetButton: classes.presetButton,
										}}
									/>
								)}
							/>
						))}
					</div>
				</DatesProvider>
			</div>
		</AppModal>
	)
}

export default VersionFormModal
