import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Select, type SelectProps, Switch, TextInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMemo } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import {
	ERROR_CODE,
	type Language,
	LANGUAGE_FLAG_CODES,
	type LanguageFlagCode,
	toValidationCode,
	type UpdateLanguageRequest,
	updateLanguageRequestSchema,
} from '@locale/shared'

import getApiErrorCode from '@/api/getApiErrorCode'
import getApiErrorDetails from '@/api/getApiErrorDetails'
import { useUpdateLanguageMutation } from '@/api/languages/useUpdateLanguageMutation'
import AppModal from '@/components/AppModal/AppModal'
import { ChevronDown } from '@/components/Icons'
import LanguageFlag from '@/components/LanguageFlag/LanguageFlag'

import { type LanguageSettingsModalProps } from './types'

const EMPTY_VALUES: UpdateLanguageRequest = { englishName: '', nativeName: '', flagCode: LANGUAGE_FLAG_CODES[0], isBase: undefined }

// `isBase` is listed so the dirty check (which compares keys) stays clean until the switch is turned on.
const toFormValues = ({ englishName, nativeName, flagCode }: Language): UpdateLanguageRequest => ({ englishName, nativeName, flagCode, isBase: undefined })

const findFlagCode = (value: string | null) => LANGUAGE_FLAG_CODES.find((code) => code === value)

const renderFlagOption: SelectProps['renderOption'] = ({ option }) => {
	const code = findFlagCode(option.value)
	return (
		<span className='flex items-center gap-2'>
			{code && <LanguageFlag code={code} size='sm' />}
			{option.label}
		</span>
	)
}

/** "Nastavenia jazyka" (not in Figma). The tag is read-only; the base switch can only be turned on. */
const LanguageSettingsModal = ({ opened, language, onClose, onDelete, inBackground }: LanguageSettingsModalProps) => {
	const { t, i18n } = useTranslation()
	const updateLanguage = useUpdateLanguageMutation()
	const { isPending } = updateLanguage
	const values = useMemo(() => (language ? toFormValues(language) : undefined), [language])
	const {
		register,
		control,
		handleSubmit,
		setError,
		reset,
		formState: { errors, isDirty },
	} = useForm({
		resolver: zodResolver(updateLanguageRequestSchema, {
			error: (issue) => {
				// zod passes a raw issue here; the fields toValidationCode reads (code, input, minimum, maximum, format) match the final issue.
				const { code, params } = toValidationCode(issue as Parameters<typeof toValidationCode>[0])
				return t(`validation.${code}`, params)
			},
		}),
		defaultValues: EMPTY_VALUES,
		values,
	})

	const regionNames = new Intl.DisplayNames([i18n.language], { type: 'region' })
	const flagOptions = LANGUAGE_FLAG_CODES.map((code: LanguageFlagCode) => ({
		value: code,
		label: `${regionNames.of(code.toUpperCase()) ?? code} (${code.toUpperCase()})`,
	}))

	const resetAndClose = () => {
		reset()
		updateLanguage.reset()
		onClose()
	}

	const handleClose = () => {
		if (!isPending) {
			resetAndClose()
		}
	}

	const onSubmit = handleSubmit((body) => {
		if (!language || isPending) {
			return
		}
		updateLanguage.mutate(
			{ id: language.id, body },
			{
				onSuccess: (saved) => {
					notifications.show({ color: 'green', message: t('languagesPage.settingsModal.success', { name: saved.englishName }) })
					resetAndClose()
				},
				onError: (error) => {
					const code = getApiErrorCode(error)
					const details = getApiErrorDetails(error)
					if (code === ERROR_CODE.VALIDATION_ERROR && details.length > 0) {
						details.forEach(({ path, code: issueCode, params }) =>
							setError(path as keyof UpdateLanguageRequest, { message: t(`validation.${issueCode}`, params) }),
						)
						return
					}
					notifications.show({ color: 'red', message: t(`errors.${code}`) })
					if (code === ERROR_CODE.NOT_FOUND) {
						resetAndClose()
					}
				},
			},
		)
	})

	return (
		<AppModal
			opened={opened && language !== null}
			onClose={handleClose}
			title={t('languagesPage.settingsModal.title')}
			description={language?.englishName}
			closeLabel={t('languagesPage.settingsModal.close')}
			isPending={isPending}
			inBackground={inBackground}
			onSubmit={(event) => void onSubmit(event)}
			footer={
				<>
					<Button
						variant='subtle'
						color='red'
						className='mr-auto'
						disabled={!language || language.isBase || isPending}
						onClick={() => language && onDelete(language)}
					>
						{t('languagesPage.settingsModal.delete')}
					</Button>
					<Button variant='default' onClick={handleClose} disabled={isPending}>
						{t('languagesPage.settingsModal.cancel')}
					</Button>
					<Button type='submit' loading={isPending} disabled={!isDirty}>
						{t('languagesPage.settingsModal.submit')}
					</Button>
				</>
			}
		>
			<div className='grid gap-4 sm:grid-cols-2'>
				<TextInput
					data-autofocus
					label={t('languagesPage.settingsModal.englishName')}
					error={errors.englishName?.message}
					{...register('englishName')}
				/>
				<TextInput label={t('languagesPage.settingsModal.nativeName')} error={errors.nativeName?.message} {...register('nativeName')} />
				<Controller
					control={control}
					name='flagCode'
					render={({ field }) => (
						<Select
							label={t('languagesPage.settingsModal.flag')}
							data={flagOptions}
							value={field.value}
							onChange={(value) => {
								const code = findFlagCode(value)
								if (code) {
									field.onChange(code)
								}
							}}
							onBlur={field.onBlur}
							allowDeselect={false}
							error={errors.flagCode?.message}
							renderOption={renderFlagOption}
							leftSection={<LanguageFlag code={field.value} size='sm' />}
							rightSection={<ChevronDown aria-hidden />}
							rightSectionPointerEvents='none'
						/>
					)}
				/>
				<TextInput
					label={t('languagesPage.settingsModal.tag.label')}
					description={t('languagesPage.settingsModal.tag.description')}
					value={language?.tag ?? ''}
					disabled
					readOnly
				/>
			</div>
			<Controller
				control={control}
				name='isBase'
				render={({ field }) => (
					<Switch
						label={t('languagesPage.settingsModal.isBase.label')}
						description={t('languagesPage.settingsModal.isBase.description')}
						checked={language?.isBase === true || field.value === true}
						disabled={language?.isBase !== false}
						onChange={(event) => field.onChange(event.currentTarget.checked ? true : undefined)}
						withThumbIndicator={false}
					/>
				)}
			/>
		</AppModal>
	)
}

export default LanguageSettingsModal
