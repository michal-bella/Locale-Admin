import { Avatar, Tooltip } from '@mantine/core'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'

import { getInitials, PROJECT_ROLE } from '@locale/shared'

import classes from './ProjectManagers.module.css'
import { type ProjectManagersProps } from './types'

/** Správcovia projektu as brand pills (initials and name, email in the tooltip) for the header of Prehľad; nothing without a MANAGER. */
const ProjectManagers = ({ members }: ProjectManagersProps) => {
	const { t } = useTranslation()
	const labelId = useId()
	const managers = members.filter((member) => member.role === PROJECT_ROLE.MANAGER)

	if (managers.length === 0) {
		return null
	}

	return (
		<div className='flex flex-wrap items-center gap-2'>
			<span id={labelId} className={classes.label}>
				{t('dashboardPage.managers.label', { count: managers.length })}
			</span>
			<ul aria-labelledby={labelId} className='flex flex-wrap items-center gap-2'>
				{managers.map((manager) => {
					const fullName = [manager.firstName, manager.lastName].filter(Boolean).join(' ')
					return (
						<li key={manager.id}>
							<Tooltip label={manager.email} disabled={!fullName}>
								<span className={classes.badge}>
									<Avatar
										aria-hidden
										size={20}
										radius='xl'
										color='var(--app-color-surface)'
										variant='filled'
										classNames={{ placeholder: classes.initials }}
									>
										{getInitials(manager)}
									</Avatar>
									{fullName || manager.email}
								</span>
							</Tooltip>
						</li>
					)
				})}
			</ul>
		</div>
	)
}

export default ProjectManagers
