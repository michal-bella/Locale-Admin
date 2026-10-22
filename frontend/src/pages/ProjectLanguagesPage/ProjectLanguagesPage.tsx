import { Button } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useLoaderData, useParams } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { type Language, ROLE, SUPPORTED_LANGUAGES } from '@locale/shared'

import { useMeQuery } from '@/api/auth/meQuery'
import { useProjectLanguagesQuery } from '@/api/projectLanguages/projectLanguagesQuery'
import AddLanguageModal from '@/components/AddLanguageModal/AddLanguageModal'
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal/ConfirmDeleteModal'
import { Plus } from '@/components/Icons'
import LanguagesTable from '@/components/LanguagesTable/LanguagesTable'
import PageIntro from '@/components/PageIntro/PageIntro'

/** Languages of the project (Figma 3:812 without the translation statistics columns): an ADMIN adds from the catalog, removes or reorders. */
const ProjectLanguagesPage = () => {
	const { t } = useTranslation()
	const { projectSlug } = useParams({ from: '/_authenticated/_app/projects/$projectSlug' })
	const { projectId } = useLoaderData({ from: '/_authenticated/_app/projects/$projectSlug' })
	const { data: languages } = useProjectLanguagesQuery(projectId)
	const { data: user } = useMeQuery()
	const isAdmin = user?.role === ROLE.ADMIN
	const [addOpened, addModal] = useDisclosure(false)
	const [deleteOpened, deleteModal] = useDisclosure(false)
	const [deleteLanguage, setDeleteLanguage] = useState<Language | null>(null)
	const allAdded = languages !== undefined && languages.length >= SUPPORTED_LANGUAGES.length

	const tableRef = useRef<HTMLTableElement>(null)
	const returnFocusRef = useRef<HTMLElement | null>(null)

	// Mantine returns focus to what was focused when a modal opened, which can be a button whose row is gone or that is disabled now.
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

	const openDelete = (language: Language, trigger: HTMLElement | null) => {
		returnFocusRef.current = trigger
		setDeleteLanguage(language)
		deleteModal.open()
	}

	const closeDelete = () => {
		deleteModal.close()
		restoreFocus()
	}

	const handleDeleted = () => {
		deleteModal.close()
		tableRef.current?.focus()
	}

	return (
		<div className='mx-auto flex w-full max-w-[1200px] flex-col gap-6 p-8'>
			<div className='flex flex-wrap items-end justify-between gap-4'>
				<PageIntro
					eyebrow={t('languagesPage.eyebrow')}
					title={t('languagesPage.title')}
					description={t(isAdmin ? 'languagesPage.description' : 'languagesPage.descriptionEditor')}
					titleSize='h2'
				/>
				{isAdmin && (
					<Button leftSection={<Plus aria-hidden />} onClick={(event) => openAdd(event.currentTarget)} disabled={!languages || allAdded}>
						{t('languagesPage.addButton')}
					</Button>
				)}
			</div>
			<LanguagesTable
				ref={tableRef}
				projectId={projectId}
				projectSlug={projectSlug}
				onAdd={isAdmin ? openAdd : undefined}
				onDelete={isAdmin ? openDelete : undefined}
				reorderable={isAdmin}
			/>
			{isAdmin && <AddLanguageModal projectId={projectId} opened={addOpened} onClose={closeAdd} languages={languages ?? []} />}
			{isAdmin && (
				<ConfirmDeleteModal projectId={projectId} opened={deleteOpened} language={deleteLanguage} onClose={closeDelete} onDeleted={handleDeleted} />
			)}
		</div>
	)
}

export default ProjectLanguagesPage
