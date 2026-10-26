import { Select } from '@mantine/core'
import { useTranslation } from 'react-i18next'

import { PROJECT_ROLE } from '@locale/shared'

import { ChevronDown, Edit, Eye, Shield } from '@/components/Icons'

import { type ProjectRoleSelectProps } from './types'

const ROLE_ICON = {
	[PROJECT_ROLE.MANAGER]: Shield,
	[PROJECT_ROLE.EDITOR]: Edit,
	[PROJECT_ROLE.VISITOR]: Eye,
} as const satisfies Record<PROJECT_ROLE, unknown>

/** Role of a member in one project (Správca, Editor, Návštevník), with an icon per role in the field and the options like the language switcher. */
const ProjectRoleSelect = ({ value, onChange, disabled, label, ariaLabel }: ProjectRoleSelectProps) => {
	const { t } = useTranslation()
	const Icon = ROLE_ICON[value]

	return (
		<Select
			label={label}
			aria-label={label ? undefined : ariaLabel}
			description={label && t(`projectRole.description.${value}`)}
			inputWrapperOrder={['label', 'input', 'description']}
			value={value}
			onChange={(role) => {
				const picked = Object.values(PROJECT_ROLE).find((candidate) => candidate === role)
				if (picked) {
					onChange(picked)
				}
			}}
			disabled={disabled}
			allowDeselect={false}
			// Three options need no scroll area (as in the language switcher).
			withScrollArea={false}
			leftSection={<Icon aria-hidden width={16} height={16} />}
			rightSection={<ChevronDown aria-hidden />}
			rightSectionPointerEvents='none'
			data={Object.values(PROJECT_ROLE).map((role) => ({ value: role, label: t(`roles.${role}`) }))}
			renderOption={({ option }) => {
				const OptionIcon = ROLE_ICON[option.value]
				return (
					<span className='inline-flex items-center gap-2'>
						<OptionIcon aria-hidden width={16} height={16} />
						{option.label}
					</span>
				)
			}}
		/>
	)
}

export default ProjectRoleSelect
