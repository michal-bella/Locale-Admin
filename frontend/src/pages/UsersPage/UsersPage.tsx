import { Button } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useTranslation } from 'react-i18next'

import CreateUserModal from '@/components/CreateUserModal/CreateUserModal'
import { Plus } from '@/components/Icons'
import PageIntro from '@/components/PageIntro/PageIntro'
import UsersTable from '@/components/UsersTable/UsersTable'

/** Figma 28:2 without the sidebar and breadcrumbs (phase 1 layout). */
const UsersPage = () => {
	const { t } = useTranslation()
	const [modalOpened, modal] = useDisclosure(false)

	return (
		<div className='mx-auto flex w-full max-w-[1200px] flex-col gap-6 p-8'>
			<div className='flex flex-wrap items-end justify-between gap-4'>
				<PageIntro eyebrow={t('usersPage.eyebrow')} title={t('usersPage.title')} description={t('usersPage.description')} titleSize='h2' />
				<Button leftSection={<Plus aria-hidden />} onClick={modal.open}>
					{t('usersPage.createButton')}
				</Button>
			</div>
			<UsersTable />
			<CreateUserModal opened={modalOpened} onClose={modal.close} />
		</div>
	)
}

export default UsersPage
