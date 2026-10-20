import { Button, Text } from '@mantine/core'
import { useTranslation } from 'react-i18next'

import AppModal from '@/components/AppModal/AppModal'

import { type ChangeBaseLanguageModalProps } from './types'

/** Confirmation after a drag and drop on the Languages page put another language first, which makes it the base language. */
const ChangeBaseLanguageModal = ({ opened, language, currentBase, isPending, onConfirm, onCancel }: ChangeBaseLanguageModalProps) => {
	const { t } = useTranslation()

	return (
		<AppModal
			opened={opened && language !== null}
			onClose={onCancel}
			title={t('languagesPage.baseModal.title')}
			closeLabel={t('languagesPage.baseModal.close')}
			isPending={isPending}
			size={440}
			footer={
				<>
					<Button variant='default' onClick={onCancel} disabled={isPending}>
						{t('languagesPage.baseModal.cancel')}
					</Button>
					<Button loading={isPending} onClick={onConfirm}>
						{t('languagesPage.baseModal.confirm')}
					</Button>
				</>
			}
		>
			<Text size='sm'>
				{language &&
					t('languagesPage.baseModal.message', {
						name: t(`languageNames.${language.tag}`),
						current: currentBase ? t(`languageNames.${currentBase.tag}`) : '',
					})}
			</Text>
		</AppModal>
	)
}

export default ChangeBaseLanguageModal
