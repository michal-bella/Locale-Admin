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

/** Body of `PATCH /api/admin/users/:id`: changes the global role, the email or both. The last `ADMIN` cannot become an `EDITOR`. */
export const updateUserRequestSchema = z
	.object({
		role: z.enum(ROLE).optional(),
		email: emailSchema.optional(),
	})
	.refine(({ role, email }) => role !== undefined || email !== undefined)

export type UpdateUserRequest = z.infer<typeof updateUserRequestSchema>

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

/** One project of a user in `GET /api/admin/users/:id`. `joinedAt` is when the user became a member. */
export const adminUserProjectSchema = z.object({
	id: z.uuid(),
	name: z.string(),
	slug: z.string(),
	primaryColor: z.string(),
	joinedAt: z.iso.datetime(),
})

export type AdminUserProject = z.infer<typeof adminUserProjectSchema>

/** Body of `GET /api/admin/users/:id`: the user with the projects they are a member of, sorted by name. */
export const adminUserDetailSchema = adminUserSchema.extend({
	projects: z.array(adminUserProjectSchema),
})

export type AdminUserDetail = z.infer<typeof adminUserDetailSchema>
