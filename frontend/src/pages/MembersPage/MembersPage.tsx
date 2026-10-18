import { Button } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useParams } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import CreateMemberModal from '@/components/CreateMemberModal/CreateMemberModal'
import { Plus } from '@/components/Icons'
import MembersTable from '@/components/MembersTable/MembersTable'
import PageIntro from '@/components/PageIntro/PageIntro'

/** Members of the project. Every member (and ADMIN) can create a new member; project roles come later. */
const MembersPage = () => {
	const { t } = useTranslation()
	const { projectId } = useParams({ from: '/_authenticated/_app/projects/$projectId' })
	const [modalOpened, modal] = useDisclosure(false)

	return (
		<div className='mx-auto flex w-full max-w-[1200px] flex-col gap-6 p-8'>
			<div className='flex flex-wrap items-end justify-between gap-4'>
				<PageIntro eyebrow={t('membersPage.eyebrow')} title={t('membersPage.title')} description={t('membersPage.description')} titleSize='h2' />
				<Button leftSection={<Plus aria-hidden />} onClick={modal.open}>
					{t('membersPage.createButton')}
				</Button>
			</div>
			<MembersTable projectId={projectId} />
			<CreateMemberModal projectId={projectId} opened={modalOpened} onClose={modal.close} />
		</div>
	)
}

export default MembersPage
