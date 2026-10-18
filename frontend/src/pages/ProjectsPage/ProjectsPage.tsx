import { Button } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { type ProjectListItem } from '@locale/shared'

import CreateProjectModal from '@/components/CreateProjectModal/CreateProjectModal'
import { Plus } from '@/components/Icons'
import LeaveProjectModal from '@/components/LeaveProjectModal/LeaveProjectModal'
import PageIntro from '@/components/PageIntro/PageIntro'
import ProjectsList from '@/components/ProjectsList/ProjectsList'

/** Index page: projects of the user (ADMIN sees all), create a project, leave a project or open it. */
const ProjectsPage = () => {
	const { t } = useTranslation()
	const [createOpened, createModal] = useDisclosure(false)
	const [leaveOpened, leaveModal] = useDisclosure(false)
	const [leaving, setLeaving] = useState<ProjectListItem | null>(null)

	const openLeave = (project: ProjectListItem) => {
		setLeaving(project)
		leaveModal.open()
	}

	return (
		<div className='mx-auto flex w-full max-w-[980px] flex-col gap-6 p-8'>
			<div className='flex flex-wrap items-end justify-between gap-4'>
				<PageIntro eyebrow={t('projectsPage.eyebrow')} title={t('projectsPage.title')} description={t('projectsPage.description')} titleSize='h2' />
				<Button leftSection={<Plus aria-hidden />} onClick={createModal.open}>
					{t('projectsPage.createButton')}
				</Button>
			</div>
			<ProjectsList onLeave={openLeave} />
			<CreateProjectModal opened={createOpened} onClose={createModal.close} />
			<LeaveProjectModal opened={leaveOpened} project={leaving} onClose={leaveModal.close} onLeft={leaveModal.close} />
		</div>
	)
}

export default ProjectsPage
