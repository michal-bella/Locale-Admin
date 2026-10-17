import { Button, getDefaultZIndex, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useTranslation } from 'react-i18next'

import { ERROR_CODE } from '@locale/shared'

import getApiErrorCode from '@/api/getApiErrorCode'
import { useDeleteLanguageMutation } from '@/api/languages/useDeleteLanguageMutation'
import AppModal from '@/components/AppModal/AppModal'

import { type ConfirmDeleteModalProps } from './types'

/** Every language delete goes through this confirmation, also when opened over "Nastavenia jazyka". */
const ConfirmDeleteModal = ({ opened, language, onClose, onDeleted }: ConfirmDeleteModalProps) => {
	const { t } = useTranslation()
	const deleteLanguage = useDeleteLanguageMutation()
	const { isPending } = deleteLanguage

	const handleClose = () => {
		if (!isPending) {
			deleteLanguage.reset()
			onClose()
		}
	}

	const handleConfirm = () => {
		if (!language || isPending) {
			return
		}
		deleteLanguage.mutate(language.id, {
			onSuccess: () => {
				notifications.show({ color: 'green', message: t('languagesPage.deleteModal.success', { name: language.englishName }) })
				onDeleted()
			},
			onError: (error) => {
				const code = getApiErrorCode(error)
				notifications.show({ color: 'red', message: t(`errors.${code}`) })
				if (code === ERROR_CODE.NOT_FOUND) {
					onDeleted()
				}
			},
		})
	}

	return (
		<AppModal
			opened={opened && language !== null}
			onClose={handleClose}
			title={t('languagesPage.deleteModal.title')}
			closeLabel={t('languagesPage.deleteModal.close')}
			isPending={isPending}
			size={440}
			// Above "Nastavenia jazyka", which stays open underneath.
			zIndex={getDefaultZIndex('modal') + 1}
			footer={
				<>
					<Button variant='default' onClick={handleClose} disabled={isPending}>
						{t('languagesPage.deleteModal.cancel')}
					</Button>
					<Button color='red' loading={isPending} onClick={handleConfirm}>
						{t('languagesPage.deleteModal.confirm')}
					</Button>
				</>
			}
		>
			<Text size='sm'>{language && t('languagesPage.deleteModal.message', { name: language.englishName, tag: language.tag })}</Text>
		</AppModal>
	)
}

export default ConfirmDeleteModal
