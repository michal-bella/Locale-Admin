import { z } from 'zod'

import { authUserSchema, ROLE, userPreferencesSchema } from './auth'
import { passwordSchema } from './password'

export const PERSON_NAME_MAX_LENGTH = 100

export const personNameSchema = z.string().trim().min(1).max(PERSON_NAME_MAX_LENGTH)

/** Body of `PATCH /api/profile`. Email is not editable, zod strips it; only an `ADMIN` may send a different `role`. */
export const updateProfileRequestSchema = z.object({
	firstName: personNameSchema,
	lastName: personNameSchema,
	role: z.enum(ROLE).optional(),
})

export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>

/** Body of `GET` and `PATCH /api/profile`. Never contains `passwordHash`. */
export const profileSchema = authUserSchema.extend({
	passwordChangedAt: z.iso.datetime(),
})

export type Profile = z.infer<typeof profileSchema>

/** Body of `PATCH /api/profile/preferences`: any of the preferences, at least one; the response is the `Profile`. */
export const updatePreferencesRequestSchema = userPreferencesSchema
	.partial()
	.refine((body) => body.translationsView !== undefined || body.translationsLayout !== undefined)

export type UpdatePreferencesRequest = z.infer<typeof updatePreferencesRequestSchema>

/** Body of `PUT /api/profile/password`: the current password is checked, the new one must satisfy `passwordSchema`; the response is the `Profile`. */
export const changePasswordRequestSchema = z.object({
	currentPassword: z.string().min(1),
	newPassword: passwordSchema,
})

export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>
