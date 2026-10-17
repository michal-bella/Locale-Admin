import { Button } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useRef, useState } from 'react'
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

	const tableRef = useRef<HTMLTableElement>(null)
	const returnFocusRef = useRef<HTMLElement | null>(null)

	// Mantine returns focus to what was focused when a modal opened: here the item of an already closed row menu, or a button whose row is gone (or that got disabled).
	// Deferred so the list has re-rendered with the refetched data and a removed row's button is already detached.
	const restoreFocus = () =>
		setTimeout(() => {
			const target = returnFocusRef.current
			;(target?.isConnected && !target.matches(':disabled') ? target : tableRef.current)?.focus()
		})

	const openAdd = (trigger: HTMLElement) => {
		returnFocusRef.current = trigger
		addModal.open()
	}

	const closeAdd = () => {
		addModal.close()
		restoreFocus()
	}

	const openSettings = (language: Language, trigger: HTMLElement | null) => {
		returnFocusRef.current = trigger
		setSettingsLanguage(language)
		settingsModal.open()
	}

	const closeSettings = () => {
		settingsModal.close()
		restoreFocus()
	}

	const openDelete = (language: Language) => {
		setDeleteLanguage(language)
		deleteModal.open()
	}

	const openDeleteFromRow = (language: Language, trigger: HTMLElement | null) => {
		returnFocusRef.current = trigger
		openDelete(language)
	}

	// Opened over the settings modal, Mantine returns focus into it.
	const closeDelete = () => {
		deleteModal.close()
		if (!settingsOpened) {
			restoreFocus()
		}
	}

	const handleDeleted = () => {
		deleteModal.close()
		settingsModal.close()
		tableRef.current?.focus()
	}

	return (
		<div className='mx-auto flex w-full max-w-[1200px] flex-col gap-6 p-8'>
			<div className='flex flex-wrap items-end justify-between gap-4'>
				<PageIntro eyebrow={t('languagesPage.eyebrow')} title={t('languagesPage.title')} description={t('languagesPage.description')} titleSize='h2' />
				<Button leftSection={<Plus aria-hidden />} onClick={(event) => openAdd(event.currentTarget)} disabled={!languages || allAdded}>
					{t('languagesPage.addButton')}
				</Button>
			</div>
			<LanguagesTable ref={tableRef} onAdd={openAdd} onEdit={openSettings} onDelete={openDeleteFromRow} />
			<AddLanguageModal opened={addOpened} onClose={closeAdd} languages={languages ?? []} />
			<LanguageSettingsModal
				opened={settingsOpened}
				language={settingsLanguage}
				onClose={closeSettings}
				onDelete={openDelete}
				inBackground={deleteOpened}
			/>
			<ConfirmDeleteModal opened={deleteOpened} language={deleteLanguage} onClose={closeDelete} onDeleted={handleDeleted} />
		</div>
	)
}

export default LanguagesPage
