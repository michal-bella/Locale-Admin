import { Select } from '@mantine/core'
import { useTranslation } from 'react-i18next'

import { PROJECT_ROLE } from '@locale/shared'

import { ChevronDown } from '@/components/Icons'

import { type ProjectRoleSelectProps } from './types'

/** Role of a member in one project (Správca, Editor, Návštevník). */
const ProjectRoleSelect = ({ value, onChange, disabled, label, ariaLabel }: ProjectRoleSelectProps) => {
	const { t } = useTranslation()

	return (
		<Select
			label={label}
			aria-label={label ? undefined : ariaLabel}
			description={label && t(`projectRole.description.${value}`)}
			inputWrapperOrder={['label', 'input', 'description']}
			size={label ? 'sm' : 'xs'}
			value={value}
			onChange={(role) => {
				const picked = Object.values(PROJECT_ROLE).find((candidate) => candidate === role)
				if (picked) {
					onChange(picked)
				}
			}}
			disabled={disabled}
			allowDeselect={false}
			rightSection={<ChevronDown aria-hidden />}
			rightSectionPointerEvents='none'
			data={Object.values(PROJECT_ROLE).map((role) => ({ value: role, label: t(`roles.${role}`) }))}
		/>
	)
}

export default ProjectRoleSelect
