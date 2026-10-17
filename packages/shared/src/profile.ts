import { z } from 'zod'

import { authUserSchema } from './auth'

export const PERSON_NAME_MAX_LENGTH = 100

export const personNameSchema = z.string().trim().min(1).max(PERSON_NAME_MAX_LENGTH)

/** Body of `PATCH /api/profile`. Email and role are not editable, zod strips them. */
export const updateProfileRequestSchema = z.object({
	firstName: personNameSchema,
	lastName: personNameSchema,
})

export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>

/** Body of `GET` and `PATCH /api/profile`. Never contains `passwordHash`. */
export const profileSchema = authUserSchema.extend({
	passwordChangedAt: z.iso.datetime(),
})

export type Profile = z.infer<typeof profileSchema>
