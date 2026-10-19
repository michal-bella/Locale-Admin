import { z } from 'zod'

import { ROLE } from './auth'
import { emailSchema } from './email'
import { passwordSchema } from './password'

/** Body of `POST /api/admin/users`. The only way to create a user; members of projects are added from existing users. */
export const createUserRequestSchema = z.object({
	email: emailSchema,
	password: passwordSchema,
	role: z.enum(ROLE),
})

export type CreateUserRequest = z.infer<typeof createUserRequestSchema>

/** One user in the admin list and the body of `201 POST /api/admin/users`. Never contains `passwordHash`. */
export const adminUserSchema = z.object({
	id: z.uuid(),
	email: z.email(),
	role: z.enum(ROLE),
	projectCount: z.number().int(),
	createdAt: z.iso.datetime(),
})

export type AdminUser = z.infer<typeof adminUserSchema>

/** Body of `GET /api/admin/users`: every user (ADMIN and EDITOR), sorted newest first. */
export const adminUserListResponseSchema = z.object({
	users: z.array(adminUserSchema),
})

export type AdminUserListResponse = z.infer<typeof adminUserListResponseSchema>
