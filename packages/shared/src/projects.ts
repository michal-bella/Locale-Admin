import { z } from 'zod'

import { createUserRequestSchema } from './adminUsers'
import { projectNameSchema, projectSlugSchema } from './projectSettings'

/** Body of `POST /api/projects`. The creator becomes a member of the new project. */
export const createProjectRequestSchema = z.object({
	name: projectNameSchema,
	slug: projectSlugSchema,
})

export type CreateProjectRequest = z.infer<typeof createProjectRequestSchema>

/** One project on the index page and the body of `201 POST /api/projects`. `isMember` is `false` only for an ADMIN outside the project. */
export const projectListItemSchema = z.object({
	id: z.uuid(),
	name: z.string(),
	slug: z.string(),
	primaryColor: z.string(),
	isMember: z.boolean(),
})

export type ProjectListItem = z.infer<typeof projectListItemSchema>

/** Body of `GET /api/projects`, sorted by name. An ADMIN gets every project, an EDITOR only projects they are a member of. */
export const projectListResponseSchema = z.object({
	projects: z.array(projectListItemSchema),
})

export type ProjectListResponse = z.infer<typeof projectListResponseSchema>

/** Body of `POST /api/projects/:projectId/members`. Creates a new EDITOR user who is a member of the project. */
export const createProjectMemberRequestSchema = createUserRequestSchema

export type CreateProjectMemberRequest = z.infer<typeof createProjectMemberRequestSchema>

/** One member in `GET /api/projects/:projectId/members` and the body of `201 POST`. `createdAt` is when the user joined the project. */
export const projectMemberSchema = z.object({
	id: z.uuid(),
	email: z.email(),
	firstName: z.string().nullable(),
	lastName: z.string().nullable(),
	createdAt: z.iso.datetime(),
})

export type ProjectMember = z.infer<typeof projectMemberSchema>

/** Body of `GET /api/projects/:projectId/members`, oldest member first. */
export const projectMemberListResponseSchema = z.object({
	members: z.array(projectMemberSchema),
})

export type ProjectMemberListResponse = z.infer<typeof projectMemberListResponseSchema>
