import { type FieldErrors, type UseFormRegister } from 'react-hook-form'

import { type UpdateProfileRequest } from '@locale/shared'

export type PersonalDetailsSectionProps = {
	register: UseFormRegister<UpdateProfileRequest>
	errors: FieldErrors<UpdateProfileRequest>
	email: string
}
