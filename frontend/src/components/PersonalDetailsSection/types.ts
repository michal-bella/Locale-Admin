import { type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form'

import { type UpdateProfileRequest } from '@locale/shared'

export type PersonalDetailsSectionProps = {
	register: UseFormRegister<UpdateProfileRequest>
	errors: FieldErrors<UpdateProfileRequest>
	control: Control<UpdateProfileRequest>
	email: string
	/** Only an ADMIN may change the global role; an EDITOR sees it disabled. */
	canChangeRole: boolean
}
