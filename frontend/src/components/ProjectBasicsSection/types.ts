import { type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form'

import { type Language, type UpdateProjectSettingsRequest } from '@locale/shared'

export type ProjectBasicsSectionProps = {
	register: UseFormRegister<UpdateProjectSettingsRequest>
	control: Control<UpdateProjectSettingsRequest>
	errors: FieldErrors<UpdateProjectSettingsRequest>
	languages: Language[]
	/** Shown in the preview while the typed color is not a valid `#RRGGBB` yet. */
	savedColor: string
	/** The base language is global, only an ADMIN may change it. */
	canChangeBaseLanguage: boolean
}
