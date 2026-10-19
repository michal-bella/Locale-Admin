import { Button } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useLoaderData } from '@tanstack/react-router'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { ROLE } from '@locale/shared'

import { useMeQuery } from '@/api/auth/meQuery'
import AddMemberModal from '@/components/AddMemberModal/AddMemberModal'
import { Plus } from '@/components/Icons'
import MembersTable from '@/components/MembersTable/MembersTable'
import PageIntro from '@/components/PageIntro/PageIntro'

/** Members of the project. Only an ADMIN adds members (from existing users); a member sees the list. */
const MembersPage = () => {
	const { t } = useTranslation()
	const { projectId } = useLoaderData({ from: '/_authenticated/_app/projects/$projectSlug' })
	const { data: me } = useMeQuery()
	const [modalOpened, modal] = useDisclosure(false)
	const triggerRef = useRef<HTMLButtonElement>(null)
	const isAdmin = me?.role === ROLE.ADMIN

	// Mantine's own return focus targets a node of the already closed nested CreateUserModal, so the trigger is focused here.
	const closeModal = () => {
		modal.close()
		triggerRef.current?.focus()
	}

	return (
		<div className='mx-auto flex w-full max-w-[1200px] flex-col gap-6 p-8'>
			<div className='flex flex-wrap items-end justify-between gap-4'>
				<PageIntro eyebrow={t('membersPage.eyebrow')} title={t('membersPage.title')} description={t('membersPage.description')} titleSize='h2' />
				{isAdmin && (
					<Button ref={triggerRef} leftSection={<Plus aria-hidden />} onClick={modal.open}>
						{t('membersPage.createButton')}
					</Button>
				)}
			</div>
			<MembersTable projectId={projectId} />
			{isAdmin && <AddMemberModal projectId={projectId} opened={modalOpened} onClose={closeModal} />}
		</div>
	)
}

export default MembersPage
