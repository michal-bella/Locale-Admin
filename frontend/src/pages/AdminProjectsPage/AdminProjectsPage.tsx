import { Button } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useTranslation } from 'react-i18next'

import AdminProjectsTable from '@/components/AdminProjectsTable/AdminProjectsTable'
import CreateProjectModal from '@/components/CreateProjectModal/CreateProjectModal'
import { Plus } from '@/components/Icons'
import PageIntro from '@/components/PageIntro/PageIntro'

/** Projekty under SPRÁVA (ADMIN only): every project with counts, edit in a modal, open and delete. No Figma, styled like Používatelia. */
const AdminProjectsPage = () => {
	const { t } = useTranslation()
	const [createOpened, createModal] = useDisclosure(false)

	return (
		<div className='mx-auto flex w-full max-w-[1200px] flex-col gap-6 p-8'>
			<div className='flex flex-wrap items-end justify-between gap-4'>
				<PageIntro
					eyebrow={t('adminProjectsPage.eyebrow')}
					title={t('adminProjectsPage.title')}
					description={t('adminProjectsPage.description')}
					titleSize='h2'
				/>
				<Button leftSection={<Plus aria-hidden />} onClick={createModal.open}>
					{t('adminProjectsPage.createButton')}
				</Button>
			</div>
			<AdminProjectsTable />
			<CreateProjectModal opened={createOpened} onClose={createModal.close} />
		</div>
	)
}

export default AdminProjectsPage
