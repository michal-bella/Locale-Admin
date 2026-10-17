import { Button, Select, type SelectProps } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ERROR_CODE, SUPPORTED_LANGUAGES } from '@locale/shared'

import getApiErrorCode from '@/api/getApiErrorCode'
import getApiErrorDetails from '@/api/getApiErrorDetails'
import { useCreateLanguageMutation } from '@/api/languages/useCreateLanguageMutation'
import AppModal from '@/components/AppModal/AppModal'
import { ChevronDown } from '@/components/Icons'
import LanguageFlag from '@/components/LanguageFlag/LanguageFlag'

import { type AddLanguageModalProps } from './types'

const findSupportedLanguage = (tag: string | null) => SUPPORTED_LANGUAGES.find((language) => language.tag === tag)

const renderOption: SelectProps['renderOption'] = ({ option }) => {
	const language = findSupportedLanguage(option.value)
	return (
		<span className='flex items-center gap-2'>
			{language && <LanguageFlag code={language.flagCode} variant='rect' />}
			{option.label}
		</span>
	)
}

/** "Pridať jazyk": a searchable select over the supported languages (searches English name, native name and tag). */
const AddLanguageModal = ({ opened, onClose, languages }: AddLanguageModalProps) => {
	const { t } = useTranslation()
	const createLanguage = useCreateLanguageMutation()
	const { isPending } = createLanguage
	const [tag, setTag] = useState<string | null>(null)
	const [fieldError, setFieldError] = useState<string>()
	const selected = findSupportedLanguage(tag)
	const addedTags = new Set(languages.map((language) => language.tag))

	const resetAndClose = () => {
		setTag(null)
		setFieldError(undefined)
		createLanguage.reset()
		onClose()
	}

	const handleClose = () => {
		if (!isPending) {
			resetAndClose()
		}
	}

	const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		if (!selected || isPending) {
			return
		}
		createLanguage.mutate(
			{ tag: selected.tag },
			{
				onSuccess: (language) => {
					notifications.show({ color: 'green', message: t('languagesPage.addModal.success', { name: language.englishName }) })
					resetAndClose()
				},
				onError: (error) => {
					const code = getApiErrorCode(error)
					const issue = getApiErrorDetails(error)[0]
					if (code === ERROR_CODE.VALIDATION_ERROR && issue) {
						setFieldError(t(`validation.${issue.code}`, issue.params))
						return
					}
					if (code === ERROR_CODE.LANGUAGE_TAKEN) {
						setTag(null)
						setFieldError(t('errors.LANGUAGE_TAKEN'))
						return
					}
					notifications.show({ color: 'red', message: t(`errors.${code}`) })
				},
			},
		)
	}

	return (
		<AppModal
			opened={opened}
			onClose={handleClose}
			title={t('languagesPage.addModal.title')}
			description={t('languagesPage.addModal.description')}
			closeLabel={t('languagesPage.addModal.close')}
			isPending={isPending}
			onSubmit={handleSubmit}
			footer={
				<>
					<Button variant='default' onClick={handleClose} disabled={isPending}>
						{t('languagesPage.addModal.cancel')}
					</Button>
					<Button type='submit' loading={isPending} disabled={!selected}>
						{t('languagesPage.addModal.submit')}
					</Button>
				</>
			}
		>
			<Select
				data-autofocus
				searchable
				label={t('languagesPage.addModal.language.label')}
				placeholder={t('languagesPage.addModal.language.placeholder')}
				nothingFoundMessage={t('languagesPage.addModal.language.nothingFound')}
				value={tag}
				onChange={(value) => {
					setTag(value)
					setFieldError(undefined)
				}}
				error={fieldError}
				data={SUPPORTED_LANGUAGES.map((language) => ({
					value: language.tag,
					label: `${language.englishName} – ${language.nativeName} – ${language.tag}`,
					disabled: addedTags.has(language.tag),
				}))}
				renderOption={renderOption}
				leftSection={selected && <LanguageFlag code={selected.flagCode} variant='rect' />}
				rightSection={<ChevronDown aria-hidden />}
				rightSectionPointerEvents='none'
			/>
		</AppModal>
	)
}

export default AddLanguageModal
