import { z } from 'zod'

import { authUserSchema, ROLE, userPreferencesSchema } from './auth'

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

/** Body of `PATCH /api/profile/preferences`; the response is the `Profile`. */
export const updatePreferencesRequestSchema = userPreferencesSchema

export type UpdatePreferencesRequest = z.infer<typeof updatePreferencesRequestSchema>
