import { Button } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useLoaderData } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { type ProjectVersion, ROLE } from '@locale/shared'

import { useMeQuery } from '@/api/auth/meQuery'
import DeleteVersionModal from '@/components/DeleteVersionModal/DeleteVersionModal'
import { Plus } from '@/components/Icons'
import PageIntro from '@/components/PageIntro/PageIntro'
import VersionFormModal from '@/components/VersionFormModal/VersionFormModal'
import VersionLockModal from '@/components/VersionLockModal/VersionLockModal'
import VersionsTable from '@/components/VersionsTable/VersionsTable'

/** Versions of the project (named date windows matching the code releases): an ADMIN creates, edits, locks, unlocks and deletes them. */
const ProjectVersionsPage = () => {
	const { t } = useTranslation()
	const { projectId } = useLoaderData({ from: '/_authenticated/_app/projects/$projectSlug' })
	const { data: user } = useMeQuery()
	const isAdmin = user?.role === ROLE.ADMIN
	const [formOpened, formModal] = useDisclosure(false)
	const [lockOpened, lockModal] = useDisclosure(false)
	const [deleteOpened, deleteModal] = useDisclosure(false)
	const [editVersion, setEditVersion] = useState<ProjectVersion | null>(null)
	const [lockVersion, setLockVersion] = useState<ProjectVersion | null>(null)
	const [deleteVersion, setDeleteVersion] = useState<ProjectVersion | null>(null)

	const tableRef = useRef<HTMLTableElement>(null)
	const returnFocusRef = useRef<HTMLElement | null>(null)

	// Same as the Languages page: Mantine returns focus to the opener, which may be disabled or gone after the refetch.
	const restoreFocus = () =>
		setTimeout(() => {
			const target = returnFocusRef.current
			;(target?.isConnected && !target.matches(':disabled') ? target : tableRef.current)?.focus()
		})

	const openCreate = (trigger: HTMLElement) => {
		returnFocusRef.current = trigger
		setEditVersion(null)
		formModal.open()
	}

	const openEdit = (version: ProjectVersion, trigger: HTMLElement) => {
		returnFocusRef.current = trigger
		setEditVersion(version)
		formModal.open()
	}

	const closeForm = () => {
		formModal.close()
		restoreFocus()
	}

	const openLock = (version: ProjectVersion, trigger: HTMLElement) => {
		returnFocusRef.current = trigger
		setLockVersion(version)
		lockModal.open()
	}

	const closeLock = () => {
		lockModal.close()
		restoreFocus()
	}

	const openDelete = (version: ProjectVersion, trigger: HTMLElement) => {
		returnFocusRef.current = trigger
		setDeleteVersion(version)
		deleteModal.open()
	}

	const closeDelete = () => {
		deleteModal.close()
		restoreFocus()
	}

	return (
		<div className='mx-auto flex w-full max-w-[1200px] flex-col gap-6 p-8'>
			<div className='flex flex-wrap items-end justify-between gap-4'>
				<PageIntro
					eyebrow={t('versionsPage.eyebrow')}
					title={t('versionsPage.title')}
					description={t(isAdmin ? 'versionsPage.description' : 'versionsPage.descriptionEditor')}
					titleSize='h2'
				/>
				{isAdmin && (
					<Button leftSection={<Plus aria-hidden />} onClick={(event) => openCreate(event.currentTarget)}>
						{t('versionsPage.createButton')}
					</Button>
				)}
			</div>
			<VersionsTable
				ref={tableRef}
				projectId={projectId}
				onCreate={isAdmin ? openCreate : undefined}
				onEdit={isAdmin ? openEdit : undefined}
				onToggleLock={isAdmin ? openLock : undefined}
				onDelete={isAdmin ? openDelete : undefined}
			/>
			{isAdmin && <VersionFormModal projectId={projectId} opened={formOpened} version={editVersion} onClose={closeForm} />}
			{isAdmin && <VersionLockModal projectId={projectId} opened={lockOpened} version={lockVersion} onClose={closeLock} />}
			{isAdmin && <DeleteVersionModal projectId={projectId} opened={deleteOpened} version={deleteVersion} onClose={closeDelete} />}
		</div>
	)
}

export default ProjectVersionsPage
