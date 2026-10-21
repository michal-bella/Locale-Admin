import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Select, Textarea, TextInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { ERROR_CODE, toValidationCode, TRANSLATION_VALUE_MAX_LENGTH, translationKeyNameSchema } from '@locale/shared'

import getApiErrorCode from '@/api/getApiErrorCode'
import getApiErrorDetails from '@/api/getApiErrorDetails'
import getPlaceholderMismatch from '@/api/getPlaceholderMismatch'
import { useCreateTranslationKeyMutation } from '@/api/translations/useCreateTranslationKeyMutation'
import AppModal from '@/components/AppModal/AppModal'
import LanguageFlag from '@/components/LanguageFlag/LanguageFlag'

import { type CreateKeyModalProps } from './types'

// Mantine's Select cannot hold "" as an option value, so the empty namespace (keys outside any CSV section) gets a stand-in.
const EMPTY_NAMESPACE = '\u0000'

const formSchema = z.object({
	name: translationKeyNameSchema,
	/** `null` until the user picks one; the field then shows the default namespace, which the submit falls back to. */
	namespace: z.string().nullable(),
	translations: z.record(z.string(), z.string().max(TRANSLATION_VALUE_MAX_LENGTH)),
})

type FormValues = z.infer<typeof formSchema>

const EMPTY_VALUES: FormValues = { name: '', namespace: null, translations: {} }

/** From this many languages the fields go into two columns above the phone breakpoint, so the form does not scroll for ages. */
const TWO_COLUMNS_FROM = 5

/**
 * "Pridať kľúč" (ADMIN only): a key added by hand into one of the existing namespaces, e.g. one that came up in development after the sheet
 * was locked. Every language of the project has an optional value; an empty one stays untranslated.
 */
const CreateKeyModal = ({ projectId, languages, namespaces, defaultNamespace, opened, onClose, onCreated }: CreateKeyModalProps) => {
	const { t } = useTranslation()
	const createKey = useCreateTranslationKeyMutation(projectId)
	const { isPending } = createKey
	const {
		register,
		handleSubmit,
		setError,
		clearErrors,
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
		defaultValues: EMPTY_VALUES,
	})
	const fallbackNamespace = defaultNamespace ?? (namespaces.length === 1 ? namespaces[0] : undefined)
	const twoColumns = languages.length >= TWO_COLUMNS_FROM
	const gridClass = `grid grid-cols-1 gap-4 ${twoColumns ? 'sm:grid-cols-2' : ''}`

	const resetAndClose = () => {
		reset(EMPTY_VALUES)
		createKey.reset()
		onClose()
	}

	const handleClose = () => {
		if (!isPending) {
			resetAndClose()
		}
	}

	const onSubmit = handleSubmit((values) => {
		const namespace = values.namespace ?? fallbackNamespace
		if (isPending) {
			return
		}
		if (namespace === undefined) {
			setError('namespace', { message: t('validation.REQUIRED') }, { shouldFocus: true })
			return
		}
		createKey.mutate(
			{ name: values.name, namespace, translations: values.translations },
			{
				onSuccess: (key) => {
					notifications.show({ color: 'green', message: t('translationsPage.createKeyModal.success', { key: key.name }) })
					resetAndClose()
					onCreated(key)
				},
				onError: (error) => {
					const mismatch = getPlaceholderMismatch(error)
					if (mismatch?.languageId) {
						const message = [
							t('errors.PLACEHOLDER_MISMATCH'),
							mismatch.missing.length > 0 && t('translationsPage.editor.missing', { list: mismatch.missing.join(', ') }),
							mismatch.extra.length > 0 && t('translationsPage.editor.extra', { list: mismatch.extra.join(', ') }),
						]
							.filter(Boolean)
							.join(' ')
						setError(`translations.${mismatch.languageId}`, { message }, { shouldFocus: true })
						return
					}
					const code = getApiErrorCode(error)
					const details = getApiErrorDetails(error)
					if (code === ERROR_CODE.VALIDATION_ERROR && details.length > 0) {
						details.forEach(({ path, code: issueCode, params }, index) => {
							const field = path === 'namespace' || path.startsWith('translations.') ? (path as 'namespace' | `translations.${string}`) : 'name'
							setError(field, { message: t(`validation.${issueCode}`, params) }, { shouldFocus: index === 0 })
						})
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
			title={t('translationsPage.createKeyModal.title')}
			description={t('translationsPage.createKeyModal.description')}
			closeLabel={t('translationsPage.createKeyModal.close')}
			isPending={isPending}
			size={twoColumns ? 720 : undefined}
			onSubmit={(event) => void onSubmit(event)}
			footer={
				<>
					<Button variant='default' onClick={handleClose} disabled={isPending}>
						{t('translationsPage.createKeyModal.cancel')}
					</Button>
					<Button type='submit' loading={isPending}>
						{t('translationsPage.createKeyModal.submit')}
					</Button>
				</>
			}
		>
			<div className={gridClass} data-columns={twoColumns ? 2 : 1}>
				<TextInput
					data-autofocus
					required
					label={t('translationsPage.createKeyModal.name.label')}
					placeholder={t('translationsPage.createKeyModal.name.placeholder')}
					error={errors.name?.message}
					{...register('name')}
				/>
				<Controller
					control={control}
					name='namespace'
					render={({ field }) => {
						const value = field.value ?? fallbackNamespace
						return (
							<Select
								required
								label={t('translationsPage.createKeyModal.namespace.label')}
								description={t('translationsPage.createKeyModal.namespace.description')}
								placeholder={t('translationsPage.createKeyModal.namespace.placeholder')}
								data={namespaces.map((namespace) => ({
									value: namespace === '' ? EMPTY_NAMESPACE : namespace,
									label: namespace === '' ? t('translationsPage.createKeyModal.namespace.empty') : namespace,
								}))}
								value={value === undefined ? null : value === '' ? EMPTY_NAMESPACE : value}
								onChange={(next) => {
									field.onChange(next === EMPTY_NAMESPACE ? '' : next)
									clearErrors('namespace')
								}}
								onBlur={field.onBlur}
								ref={field.ref}
								error={errors.namespace?.message}
								allowDeselect={false}
								searchable
								comboboxProps={{ withinPortal: true }}
							/>
						)
					}}
				/>
			</div>
			<div className={gridClass}>
				{languages.map((language) => (
					<Textarea
						key={language.id}
						label={
							<span className='inline-flex items-center gap-2'>
								<LanguageFlag code={language.flagCode} size='xs' />
								<span className='capitalize'>{t(`languageNames.${language.tag}`)}</span>
							</span>
						}
						description={language.isBase ? t('translationsPage.createKeyModal.value.base') : undefined}
						placeholder={t('translationsPage.createKeyModal.value.placeholder')}
						maxLength={TRANSLATION_VALUE_MAX_LENGTH}
						autosize
						minRows={1}
						maxRows={4}
						error={errors.translations?.[language.id]?.message}
						{...register(`translations.${language.id}`)}
					/>
				))}
			</div>
		</AppModal>
	)
}

export default CreateKeyModal
