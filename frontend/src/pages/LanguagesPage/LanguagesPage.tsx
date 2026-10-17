import { Button } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { type Language, SUPPORTED_LANGUAGES } from '@locale/shared'

import { useLanguagesQuery } from '@/api/languages/languagesQuery'
import AddLanguageModal from '@/components/AddLanguageModal/AddLanguageModal'
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal/ConfirmDeleteModal'
import { Plus } from '@/components/Icons'
import LanguageSettingsModal from '@/components/LanguageSettingsModal/LanguageSettingsModal'
import LanguagesTable from '@/components/LanguagesTable/LanguagesTable'
import PageIntro from '@/components/PageIntro/PageIntro'

/** Figma 3:812 without the sidebar, breadcrumbs and translation statistics columns. */
const LanguagesPage = () => {
	const { t } = useTranslation()
	const { data: languages } = useLanguagesQuery()
	const [addOpened, addModal] = useDisclosure(false)
	const [settingsOpened, settingsModal] = useDisclosure(false)
	const [settingsLanguage, setSettingsLanguage] = useState<Language | null>(null)
	const [deleteOpened, deleteModal] = useDisclosure(false)
	const [deleteLanguage, setDeleteLanguage] = useState<Language | null>(null)
	const allAdded = languages !== undefined && languages.length >= SUPPORTED_LANGUAGES.length

	const openSettings = (language: Language) => {
		setSettingsLanguage(language)
		settingsModal.open()
	}

	const openDelete = (language: Language) => {
		setDeleteLanguage(language)
		deleteModal.open()
	}

	const handleDeleted = () => {
		deleteModal.close()
		settingsModal.close()
	}

	return (
		<div className='mx-auto flex w-full max-w-[1200px] flex-col gap-6 p-8'>
			<div className='flex flex-wrap items-end justify-between gap-4'>
				<PageIntro eyebrow={t('languagesPage.eyebrow')} title={t('languagesPage.title')} description={t('languagesPage.description')} titleSize='h2' />
				<Button leftSection={<Plus aria-hidden />} onClick={addModal.open} disabled={!languages || allAdded}>
					{t('languagesPage.addButton')}
				</Button>
			</div>
			<LanguagesTable onAdd={addModal.open} onEdit={openSettings} onDelete={openDelete} />
			<AddLanguageModal opened={addOpened} onClose={addModal.close} languages={languages ?? []} />
			<LanguageSettingsModal
				opened={settingsOpened}
				language={settingsLanguage}
				onClose={settingsModal.close}
				onDelete={openDelete}
				inBackground={deleteOpened}
			/>
			<ConfirmDeleteModal opened={deleteOpened} language={deleteLanguage} onClose={deleteModal.close} onDeleted={handleDeleted} />
		</div>
	)
}

export default LanguagesPage
