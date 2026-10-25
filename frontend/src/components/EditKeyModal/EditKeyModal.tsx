import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Checkbox, Textarea, TextInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { type KeyboardEvent } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import {
	detectPluralVariable,
	ERROR_CODE,
	PLURAL_VARIABLE_DEFAULT,
	toValidationCode,
	TRANSLATION_KEY_DESCRIPTION_MAX_LENGTH,
	type TranslationListItem,
	translationKeyNameSchema,
	translationKeyPluralSchema,
	type UpdateTranslationKeyRequestInput,
} from '@locale/shared'

import getApiErrorCode from '@/api/getApiErrorCode'
import getApiErrorDetails from '@/api/getApiErrorDetails'
import { useUpdateTranslationKeyMutation } from '@/api/translations/useUpdateTranslationKeyMutation'
import AppModal from '@/components/AppModal/AppModal'

import { type EditKeyModalProps } from './types'

/** Form shape of the General tab; the request body is built from the fields that differ from the key. */
const formSchema = z
	.object({
		name: translationKeyNameSchema,
		description: z.string().trim().max(TRANSLATION_KEY_DESCRIPTION_MAX_LENGTH),
		pluralEnabled: z.boolean(),
		pluralVariable: z.string(),
	})
	.superRefine((values, context) => {
		if (!values.pluralEnabled) {
			return
		}
		// Re-added without `message`, so the resolver's translation below applies to these issues too.
		translationKeyPluralSchema.shape.variable.safeParse(values.pluralVariable).error?.issues.forEach(({ message: _message, ...issue }) => {
			context.addIssue({ ...issue, path: ['pluralVariable'] })
		})
	})

type FormValues = z.infer<typeof formSchema>

const FIELD_BY_PATH: Record<string, keyof FormValues> = {
	name: 'name',
	description: 'description',
	'plural.variable': 'pluralVariable',
	plural: 'pluralVariable',
}

/** Variable of a key without a plural setting whose translations already are plural messages; the form starts with plural on. */
const detectedPlural = (item: TranslationListItem | null, canEditKey: boolean): string | null =>
	canEditKey && item && item.plural === null ? detectPluralVariable(Object.values(item.translations).map((cell) => cell.value)) : null

const toFormValues = (item: TranslationListItem | null, canEditKey: boolean): FormValues => {
	const variable = item?.plural?.variable ?? detectedPlural(item, canEditKey)
	return {
		name: item?.name ?? '',
		description: item?.description ?? '',
		pluralEnabled: variable !== null,
		pluralVariable: variable ?? PLURAL_VARIABLE_DEFAULT,
	}
}

const toBody = (item: TranslationListItem, values: FormValues): UpdateTranslationKeyRequestInput => {
	const body: UpdateTranslationKeyRequestInput = {}
	if (values.name !== item.name) {
		body.name = values.name
	}
	const description = values.description === '' ? null : values.description
	if (description !== item.description) {
		body.description = description
	}
	const plural = values.pluralEnabled ? { variable: values.pluralVariable } : null
	if ((plural === null) !== (item.plural === null) || plural?.variable !== item.plural?.variable) {
		body.plural = plural
	}
	return body
}

/** A key name is one line: Enter in the wrapping field saves instead of adding a line break. */
const submitOnEnter = (event: KeyboardEvent<HTMLTextAreaElement>) => {
	if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
		event.preventDefault()
		event.currentTarget.form?.requestSubmit()
	}
}

/**
 * "Upraviť kľúč": name, description and plural forms of a key; sends only the changed fields. A key without a plural setting
 * whose translations are plural messages opens with plural on and the detected variable, so Uložiť turns it on.
 * Without `canEditKey` (an EDITOR) the name and plural forms are read-only, without `canEditDescription` (a locked version) the description too.
 * Read-only fields stay `readOnly` (the long key can still be selected and scrolled) but look disabled through Mantine's `data-disabled`.
 */
const EditKeyModal = ({ projectId, item, opened, onClose, canEditKey, canEditDescription }: EditKeyModalProps) => {
	const { t } = useTranslation()
	const updateKey = useUpdateTranslationKeyMutation(projectId)
	const { isPending } = updateKey
	const {
		register,
		handleSubmit,
		setError,
		reset,
		control,
		formState: { errors },
	} = useForm({
		resolver: zodResolver(formSchema, {
			error: (issue) => {
				// zod passes a raw issue here; the fields toValidationCode reads (code, input, minimum, maximum, format) match the final issue.
				const { code, params } = toValidationCode(issue as Parameters<typeof toValidationCode>[0])
				return t(`validation.${code}`, params)
			},
		}),
		values: toFormValues(item, canEditKey),
	})
	const pluralEnabled = useWatch({ control, name: 'pluralEnabled' })
	const watchedValues = useWatch({ control })
	// The same diff the request sends, so a key that opens with a detected plural can still be saved without touching the form.
	const unchanged = item !== null && Object.keys(toBody(item, { ...toFormValues(item, canEditKey), ...watchedValues })).length === 0
	const detectedVariable = detectedPlural(item, canEditKey)

	const resetAndClose = () => {
		reset()
		updateKey.reset()
		onClose()
	}

	const handleClose = () => {
		if (!isPending) {
			resetAndClose()
		}
	}

	const onSubmit = handleSubmit((values) => {
		if (isPending || !item) {
			return
		}
		const body = toBody(item, values)
		if (Object.keys(body).length === 0) {
			resetAndClose()
			return
		}
		updateKey.mutate(
			{ keyId: item.keyId, body },
			{
				onSuccess: (key) => {
					notifications.show({ color: 'green', message: t('translationsPage.editKeyModal.success', { key: key.name }) })
					resetAndClose()
				},
				onError: (error) => {
					const code = getApiErrorCode(error)
					const details = getApiErrorDetails(error)
					if (code === ERROR_CODE.VALIDATION_ERROR && details.length > 0) {
						details.forEach(({ path, code: issueCode, params }, index) =>
							setError(FIELD_BY_PATH[path] ?? 'name', { message: t(`validation.${issueCode}`, params) }, { shouldFocus: index === 0 }),
						)
						return
					}
					if (code === ERROR_CODE.TRANSLATION_KEY_TAKEN) {
						setError('name', { message: t('errors.TRANSLATION_KEY_TAKEN') }, { shouldFocus: true })
						return
					}
					notifications.show({ color: 'red', message: t(`errors.${code}`) })
				},
			},
		)
	})

	return (
		<AppModal
			opened={opened}
			onClose={handleClose}
			title={t('translationsPage.editKeyModal.title')}
			closeLabel={t('translationsPage.editKeyModal.close')}
			isPending={isPending}
			onSubmit={(event) => void onSubmit(event)}
			footer={
				<>
					<Button variant='default' onClick={handleClose} disabled={isPending}>
						{t('translationsPage.editKeyModal.cancel')}
					</Button>
					<Button type='submit' loading={isPending} disabled={unchanged}>
						{t('translationsPage.editKeyModal.submit')}
					</Button>
				</>
			}
		>
			<Textarea
				data-autofocus={canEditKey || undefined}
				required={canEditKey}
				readOnly={!canEditKey}
				data-disabled={!canEditKey || undefined}
				label={t('translationsPage.editKeyModal.name.label')}
				autosize
				minRows={1}
				error={errors.name?.message}
				onKeyDown={submitOnEnter}
				{...register('name')}
			/>
			<Textarea
				data-autofocus={(!canEditKey && canEditDescription) || undefined}
				readOnly={!canEditDescription}
				data-disabled={!canEditDescription || undefined}
				label={t('translationsPage.editKeyModal.description.label')}
				placeholder={t('translationsPage.editKeyModal.description.placeholder')}
				maxLength={TRANSLATION_KEY_DESCRIPTION_MAX_LENGTH}
				autosize
				minRows={3}
				maxRows={5}
				error={errors.description?.message}
				{...register('description')}
			/>
			<Checkbox
				disabled={!canEditKey}
				label={t('translationsPage.editKeyModal.plural.label')}
				description={
					detectedVariable === null
						? t('translationsPage.editKeyModal.plural.description')
						: t('translationsPage.editKeyModal.plural.detected', { variable: detectedVariable })
				}
				{...register('pluralEnabled')}
			/>
			{pluralEnabled && (
				<TextInput
					readOnly={!canEditKey}
					data-disabled={!canEditKey || undefined}
					label={t('translationsPage.editKeyModal.variable.label')}
					error={errors.pluralVariable?.message}
					{...register('pluralVariable')}
				/>
			)}
		</AppModal>
	)
}

export default EditKeyModal
