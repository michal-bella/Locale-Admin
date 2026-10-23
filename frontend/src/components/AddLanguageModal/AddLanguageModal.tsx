import { Button, Select } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { type SubmitEvent, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ERROR_CODE } from '@locale/shared'

import getApiErrorCode from '@/api/getApiErrorCode'
import getApiErrorDetails from '@/api/getApiErrorDetails'
import { useCreateProjectLanguageMutation } from '@/api/projectLanguages/useCreateProjectLanguageMutation'
import AppModal from '@/components/AppModal/AppModal'
import { ChevronDown } from '@/components/Icons'
import LanguageFlag from '@/components/LanguageFlag/LanguageFlag'
import { findSupportedLanguage, getLanguageOptions, renderLanguageOption } from '@/lib/languageOptions'

import { type AddLanguageModalProps } from './types'

/** "Pridať jazyk" of a project: a searchable select over the supported languages (searches English name, native name and tag). */
const AddLanguageModal = ({ projectId, opened, onClose, languages }: AddLanguageModalProps) => {
	const { t } = useTranslation()
	const createLanguage = useCreateProjectLanguageMutation(projectId)
	const { isPending } = createLanguage
	const [tag, setTag] = useState<string | null>(null)
	const [fieldError, setFieldError] = useState<string>()
	const inputRef = useRef<HTMLInputElement>(null)
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

	const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
		event.preventDefault()
		if (!selected || isPending) {
			return
		}
		createLanguage.mutate(
			{ tag: selected.tag },
			{
				onSuccess: (language) => {
					notifications.show({ color: 'green', message: t('languagesPage.addModal.success', { name: t(`languageNames.${language.tag}`) }) })
					resetAndClose()
				},
				onError: (error) => {
					const code = getApiErrorCode(error)
					const issue = getApiErrorDetails(error)[0]
					if (code === ERROR_CODE.VALIDATION_ERROR && issue) {
						setFieldError(t(`validation.${issue.code}`, issue.params))
						inputRef.current?.focus()
						return
					}
					if (code === ERROR_CODE.LANGUAGE_TAKEN) {
						setTag(null)
						setFieldError(t('errors.LANGUAGE_TAKEN'))
						inputRef.current?.focus()
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
				ref={inputRef}
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
				data={getLanguageOptions(addedTags)}
				renderOption={renderLanguageOption}
				leftSection={selected && <LanguageFlag code={selected.flagCode} size='sm' />}
				rightSection={<ChevronDown aria-hidden />}
				rightSectionPointerEvents='none'
			/>
		</AppModal>
	)
}

export default AddLanguageModal
