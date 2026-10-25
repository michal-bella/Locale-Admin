import { Skeleton, Text } from '@mantine/core'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { ROLE } from '@locale/shared'

import getApiErrorCode from '@/api/getApiErrorCode'
import { useProjectsQuery } from '@/api/projects/projectsQuery'
import ProfileSection from '@/components/ProfileSection/ProfileSection'
import RoleBadge from '@/components/RoleBadge/RoleBadge'
import { getProjectInitials, isLightColor } from '@/lib/utils'

import classes from './ProfileProjectsSection.module.css'

/** "Moje projekty" on the profile of a USER: each project with the role the user has in it (an ADMIN changes it on the members page). */
const ProfileProjectsSection = () => {
	const { t } = useTranslation()
	const { data, isPending, isError, error } = useProjectsQuery()

	const renderBody = () => {
		if (isPending) {
			return <Skeleton height={32} radius='sm' />
		}
		if (isError) {
			return <Text size='sm'>{t(`errors.${getApiErrorCode(error)}`)}</Text>
		}
		const { projects } = data
		if (projects.length === 0) {
			return <Text size='sm'>{t('profilePage.projects.empty')}</Text>
		}
		return (
			<ul aria-label={t('profilePage.projects.label')} className='flex flex-col gap-3'>
				{projects.map((project) => (
					<li key={project.id} className='flex items-center gap-3'>
						<span
							aria-hidden
							data-tone={isLightColor(project.primaryColor) ? 'dark' : 'light'}
							className={classes.avatar}
							style={{ backgroundColor: project.primaryColor }}
						>
							{getProjectInitials(project.name)}
						</span>
						<Link to='/projects/$projectSlug/translations' params={{ projectSlug: project.slug }} className={classes.name}>
							{project.name}
						</Link>
						{project.myRole !== ROLE.ADMIN && <RoleBadge role={project.myRole} />}
					</li>
				))}
			</ul>
		)
	}

	return (
		<ProfileSection title={t('profilePage.projects.title')} description={t('profilePage.projects.description')}>
			{renderBody()}
		</ProfileSection>
	)
}

export default ProfileProjectsSection
