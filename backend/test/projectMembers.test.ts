import request from 'supertest'
import { describe, expect, it } from 'vitest'

import {
	ACTIVITY_TYPE,
	ERROR_CODE,
	PROJECT_ROLE,
	ROLE,
	VALIDATION_CODE,
	errorResponseSchema,
	projectMemberListResponseSchema,
	projectMemberSchema,
} from '@locale/shared'

import { createTestApp } from './helpers/app'
import { CSRF_HEADERS, loginAs } from './helpers/auth'
import { getTestPrisma } from './helpers/db'
import { TEST_PASSWORD, createUser } from './helpers/users'

type App = ReturnType<typeof createTestApp>

const expectErrorCode = (res: request.Response, status: number, code: ERROR_CODE) => {
	expect(res.status).toBe(status)
	expect(errorResponseSchema.parse(res.body).error.code).toBe(code)
}

const login = async (app: App, role: ROLE = ROLE.USER) => {
	const { user } = await createUser({ role })
	return { user, cookie: await loginAs(app, { email: user.email, password: TEST_PASSWORD }) }
}

const createProjectRow = (memberIds: string[] = [], role?: PROJECT_ROLE) =>
	getTestPrisma().project.create({ data: { name: 'A', slug: 'a', members: { create: memberIds.map((userId) => ({ userId, role })) } } })

const membersUrl = (projectId: string) => `/api/projects/${projectId}/members`

const postMember = (app: App, cookie: string, projectId: string, body: unknown) =>
	request(app)
		.post(membersUrl(projectId))
		.set('Cookie', cookie)
		.set(CSRF_HEADERS)
		.send(body as object)

describe('GET /api/projects/:projectId/members', () => {
	it('returns the members oldest first with role and projectCount and without passwordHash', async () => {
		const app = createTestApp()
		const { user, cookie } = await login(app)
		const { user: other } = await createUser({ firstName: 'Jana', lastName: 'Nováková' })
		const project = await createProjectRow()
		await getTestPrisma().project.create({ data: { name: 'B', slug: 'b', members: { create: [{ userId: other.id }] } } })
		await getTestPrisma().projectMember.create({ data: { projectId: project.id, userId: user.id, createdAt: new Date('2026-01-01T00:00:00Z') } })
		await getTestPrisma().projectMember.create({ data: { projectId: project.id, userId: other.id, createdAt: new Date('2026-02-01T00:00:00Z') } })

		const res = await request(app).get(membersUrl(project.id)).set('Cookie', cookie)

		expect(res.status).toBe(200)
		const { members } = projectMemberListResponseSchema.extend({ members: projectMemberSchema.strict().array() }).strict().parse(res.body)
		expect(members).toEqual([
			{
				id: user.id,
				email: user.email,
				firstName: null,
				lastName: null,
				role: PROJECT_ROLE.EDITOR,
				projectCount: 1,
				createdAt: '2026-01-01T00:00:00.000Z',
			},
			{
				id: other.id,
				email: other.email,
				firstName: 'Jana',
				lastName: 'Nováková',
				role: PROJECT_ROLE.EDITOR,
				projectCount: 2,
				createdAt: '2026-02-01T00:00:00.000Z',
			},
		])
	})

	it('returns 404 NOT_FOUND to an EDITOR who is not a member', async () => {
		const app = createTestApp()
		const { cookie } = await login(app)
		const project = await createProjectRow()

		const res = await request(app).get(membersUrl(project.id)).set('Cookie', cookie)

		expectErrorCode(res, 404, ERROR_CODE.NOT_FOUND)
	})
})

describe('POST /api/projects/:projectId/members', () => {
	it('lets an ADMIN add an existing user and keeps their account unchanged', async () => {
		const app = createTestApp()
		const { cookie } = await login(app, ROLE.ADMIN)
		const { user: existing } = await createUser({ firstName: 'Jana', lastName: 'Nováková' })
		const project = await createProjectRow()
		const before = Date.now()

		const res = await postMember(app, cookie, project.id, { userId: existing.id })

		expect(res.status).toBe(201)
		const body = projectMemberSchema.strict().parse(res.body)
		expect(body).toMatchObject({ id: existing.id, email: existing.email, firstName: 'Jana', lastName: 'Nováková', role: PROJECT_ROLE.EDITOR })
		expect(new Date(body.createdAt).getTime()).toBeGreaterThanOrEqual(before - 1000)
		expect(await getTestPrisma().projectMember.count({ where: { projectId: project.id, userId: existing.id } })).toBe(1)
		expect(await getTestPrisma().user.findUniqueOrThrow({ where: { id: existing.id } })).toMatchObject({
			passwordHash: existing.passwordHash,
			role: ROLE.USER,
		})
	})

	it('lets an ADMIN add a member with a role', async () => {
		const app = createTestApp()
		const { cookie } = await login(app, ROLE.ADMIN)
		const { user: existing } = await createUser()
		const project = await createProjectRow()

		const res = await postMember(app, cookie, project.id, { userId: existing.id, role: PROJECT_ROLE.VISITOR })

		expect(res.status).toBe(201)
		expect(projectMemberSchema.parse(res.body).role).toBe(PROJECT_ROLE.VISITOR)
		expect(
			await getTestPrisma().projectMember.findUniqueOrThrow({ where: { projectId_userId: { projectId: project.id, userId: existing.id } } }),
		).toMatchObject({
			role: PROJECT_ROLE.VISITOR,
		})
	})

	it('lets an ADMIN add a user to a second project', async () => {
		const app = createTestApp()
		const { cookie } = await login(app, ROLE.ADMIN)
		const { user: existing } = await createUser()
		await createProjectRow([existing.id])
		const second = await getTestPrisma().project.create({ data: { name: 'B', slug: 'b' } })

		const res = await postMember(app, cookie, second.id, { userId: existing.id })

		expect(res.status).toBe(201)
		expect(await getTestPrisma().projectMember.count({ where: { userId: existing.id } })).toBe(2)
	})

	it('returns 403 FORBIDDEN to an EDITOR who is a member', async () => {
		const app = createTestApp()
		const { user, cookie } = await login(app)
		const { user: other } = await createUser()
		const project = await createProjectRow([user.id])

		const res = await postMember(app, cookie, project.id, { userId: other.id })

		expectErrorCode(res, 403, ERROR_CODE.FORBIDDEN)
		expect(await getTestPrisma().projectMember.count({ where: { projectId: project.id } })).toBe(1)
	})

	it('returns 404 NOT_FOUND to an EDITOR who is not a member', async () => {
		const app = createTestApp()
		const { cookie } = await login(app)
		const { user: other } = await createUser()
		const project = await createProjectRow()

		const res = await postMember(app, cookie, project.id, { userId: other.id })

		expectErrorCode(res, 404, ERROR_CODE.NOT_FOUND)
		expect(await getTestPrisma().projectMember.count()).toBe(0)
	})

	it('returns 409 MEMBER_IS_ADMIN for an ADMIN and adds nothing', async () => {
		const app = createTestApp()
		const { cookie } = await login(app, ROLE.ADMIN)
		const { user: admin } = await createUser({ role: ROLE.ADMIN })
		const project = await createProjectRow()

		const res = await postMember(app, cookie, project.id, { userId: admin.id })

		expectErrorCode(res, 409, ERROR_CODE.MEMBER_IS_ADMIN)
		expect(await getTestPrisma().projectMember.count()).toBe(0)
	})

	it('returns 403 FORBIDDEN to a MANAGER who is a member', async () => {
		const app = createTestApp()
		const { user, cookie } = await login(app)
		const { user: other } = await createUser()
		const project = await createProjectRow([user.id], PROJECT_ROLE.MANAGER)

		const res = await postMember(app, cookie, project.id, { userId: other.id })

		expectErrorCode(res, 403, ERROR_CODE.FORBIDDEN)
		expect(await getTestPrisma().projectMember.count({ where: { projectId: project.id } })).toBe(1)
	})

	it('returns 404 NOT_FOUND for an unknown user', async () => {
		const app = createTestApp()
		const { cookie } = await login(app, ROLE.ADMIN)
		const project = await createProjectRow()

		const res = await postMember(app, cookie, project.id, { userId: '00000000-0000-4000-8000-000000000999' })

		expectErrorCode(res, 404, ERROR_CODE.NOT_FOUND)
		expect(await getTestPrisma().projectMember.count()).toBe(0)
	})

	it('returns 409 ALREADY_MEMBER for a user who is already in the project', async () => {
		const app = createTestApp()
		const { cookie } = await login(app, ROLE.ADMIN)
		const { user: existing } = await createUser()
		const project = await createProjectRow([existing.id])

		const res = await postMember(app, cookie, project.id, { userId: existing.id })

		expectErrorCode(res, 409, ERROR_CODE.ALREADY_MEMBER)
		expect(await getTestPrisma().projectMember.count({ where: { projectId: project.id } })).toBe(1)
	})

	it.each([
		{ name: 'a missing userId', body: {}, details: [{ path: 'userId', code: VALIDATION_CODE.REQUIRED }] },
		{ name: 'a userId that is not a UUID', body: { userId: 'not-a-uuid' }, details: [{ path: 'userId', code: VALIDATION_CODE.INVALID }] },
		{
			name: 'a role that is not a project role',
			body: { userId: '6f1c0f8e-1b7e-4c47-9a53-0a4b1f3e2d11', role: ROLE.ADMIN },
			details: [{ path: 'role', code: VALIDATION_CODE.INVALID }],
		},
	])('returns 400 VALIDATION_ERROR with details for $name', async ({ body, details }) => {
		const app = createTestApp()
		const { cookie } = await login(app, ROLE.ADMIN)
		const project = await createProjectRow()

		const res = await postMember(app, cookie, project.id, body)

		expectErrorCode(res, 400, ERROR_CODE.VALIDATION_ERROR)
		expect(errorResponseSchema.parse(res.body).error.details).toEqual(details)
	})

	it('returns 403 CSRF_REJECTED without X-Requested-With', async () => {
		const app = createTestApp()
		const { cookie } = await login(app, ROLE.ADMIN)
		const { user: other } = await createUser()
		const project = await createProjectRow()

		const res = await request(app).post(membersUrl(project.id)).set('Cookie', cookie).send({ userId: other.id })

		expectErrorCode(res, 403, ERROR_CODE.CSRF_REJECTED)
		expect(await getTestPrisma().projectMember.count()).toBe(0)
	})
})

describe('PATCH /api/projects/:projectId/members/:userId', () => {
	const patchMember = (app: App, cookie: string, projectId: string, userId: string, body: unknown) =>
		request(app)
			.patch(`${membersUrl(projectId)}/${userId}`)
			.set('Cookie', cookie)
			.set(CSRF_HEADERS)
			.send(body as object)

	const roleOf = async (projectId: string, userId: string) =>
		(await getTestPrisma().projectMember.findUniqueOrThrow({ where: { projectId_userId: { projectId, userId } } })).role

	it('lets an ADMIN change the role of a member in one project only and records it', async () => {
		const app = createTestApp()
		const { user: admin, cookie } = await login(app, ROLE.ADMIN)
		const { user: member } = await createUser({ firstName: 'Jana', lastName: 'Nováková' })
		const project = await createProjectRow([member.id])
		const other = await getTestPrisma().project.create({ data: { name: 'B', slug: 'b', members: { create: { userId: member.id } } } })

		const res = await patchMember(app, cookie, project.id, member.id, { role: PROJECT_ROLE.MANAGER })

		expect(res.status).toBe(200)
		expect(projectMemberSchema.strict().parse(res.body)).toMatchObject({ id: member.id, role: PROJECT_ROLE.MANAGER, projectCount: 2 })
		expect(await roleOf(project.id, member.id)).toBe(PROJECT_ROLE.MANAGER)
		expect(await roleOf(other.id, member.id)).toBe(PROJECT_ROLE.EDITOR)
		expect(await getTestPrisma().activityEvent.findMany({ where: { projectId: project.id }, select: { type: true, userId: true, payload: true } })).toEqual(
			[
				{
					type: ACTIVITY_TYPE.MEMBER_ROLE_CHANGED,
					userId: admin.id,
					payload: {
						member: { id: member.id, firstName: 'Jana', lastName: 'Nováková', email: member.email },
						fromRole: PROJECT_ROLE.EDITOR,
						toRole: PROJECT_ROLE.MANAGER,
					},
				},
			],
		)
	})

	it('records nothing when the role stays the same', async () => {
		const app = createTestApp()
		const { cookie } = await login(app, ROLE.ADMIN)
		const { user: member } = await createUser()
		const project = await createProjectRow([member.id], PROJECT_ROLE.VISITOR)

		const res = await patchMember(app, cookie, project.id, member.id, { role: PROJECT_ROLE.VISITOR })

		expect(res.status).toBe(200)
		expect(await getTestPrisma().activityEvent.count()).toBe(0)
	})

	it('records one role change for two concurrent identical changes', async () => {
		const app = createTestApp()
		const { cookie } = await login(app, ROLE.ADMIN)
		const { user: member } = await createUser()
		const project = await createProjectRow([member.id])

		const responses = await Promise.all([
			patchMember(app, cookie, project.id, member.id, { role: PROJECT_ROLE.MANAGER }),
			patchMember(app, cookie, project.id, member.id, { role: PROJECT_ROLE.MANAGER }),
		])

		expect(responses.map((res) => res.status)).toEqual([200, 200])
		expect(await getTestPrisma().activityEvent.count({ where: { type: ACTIVITY_TYPE.MEMBER_ROLE_CHANGED } })).toBe(1)
	})

	it('returns 404 NOT_FOUND instead of 500 when the member is removed concurrently', async () => {
		const app = createTestApp()
		const { cookie } = await login(app, ROLE.ADMIN)
		const { user: member } = await createUser()
		const project = await createProjectRow([member.id])

		const [patched, removed] = await Promise.all([
			patchMember(app, cookie, project.id, member.id, { role: PROJECT_ROLE.MANAGER }),
			request(app)
				.delete(`${membersUrl(project.id)}/${member.id}`)
				.set('Cookie', cookie)
				.set(CSRF_HEADERS)
				.send({}),
		])

		expect(removed.status).toBe(204)
		expect([200, 404]).toContain(patched.status)
	})

	it('returns 403 FORBIDDEN to a MANAGER of the project and keeps the role', async () => {
		const app = createTestApp()
		const { user, cookie } = await login(app)
		const { user: other } = await createUser()
		const project = await createProjectRow([user.id], PROJECT_ROLE.MANAGER)
		await getTestPrisma().projectMember.create({ data: { projectId: project.id, userId: other.id } })

		const res = await patchMember(app, cookie, project.id, other.id, { role: PROJECT_ROLE.MANAGER })

		expectErrorCode(res, 403, ERROR_CODE.FORBIDDEN)
		expect(await roleOf(project.id, other.id)).toBe(PROJECT_ROLE.EDITOR)
	})

	it.each([
		{ name: 'a user who is not a member', userId: async () => (await createUser()).user.id },
		{ name: 'an id that is not a UUID', userId: () => Promise.resolve('not-a-uuid') },
	])('returns 404 NOT_FOUND for $name', async ({ userId }) => {
		const app = createTestApp()
		const { cookie } = await login(app, ROLE.ADMIN)
		const project = await createProjectRow()

		const res = await patchMember(app, cookie, project.id, await userId(), { role: PROJECT_ROLE.MANAGER })

		expectErrorCode(res, 404, ERROR_CODE.NOT_FOUND)
	})

	it('returns 400 VALIDATION_ERROR for a role that is not a project role', async () => {
		const app = createTestApp()
		const { cookie } = await login(app, ROLE.ADMIN)
		const { user: member } = await createUser()
		const project = await createProjectRow([member.id])

		const res = await patchMember(app, cookie, project.id, member.id, { role: ROLE.ADMIN })

		expectErrorCode(res, 400, ERROR_CODE.VALIDATION_ERROR)
		expect(errorResponseSchema.parse(res.body).error.details).toEqual([{ path: 'role', code: VALIDATION_CODE.INVALID }])
		expect(await roleOf(project.id, member.id)).toBe(PROJECT_ROLE.EDITOR)
	})
})

describe('DELETE /api/projects/:projectId/members/:userId', () => {
	const removeMember = (app: App, cookie: string, projectId: string, userId: string) =>
		request(app)
			.delete(`${membersUrl(projectId)}/${userId}`)
			.set('Cookie', cookie)
			.set(CSRF_HEADERS)
			.send({})

	it('lets an ADMIN remove a member and keeps the user account', async () => {
		const app = createTestApp()
		const { cookie } = await login(app, ROLE.ADMIN)
		const { user: other } = await createUser()
		const project = await createProjectRow([other.id, (await createUser()).user.id])

		const res = await removeMember(app, cookie, project.id, other.id)

		expect(res.status).toBe(204)
		expect(await getTestPrisma().projectMember.count({ where: { projectId: project.id, userId: other.id } })).toBe(0)
		expect(await getTestPrisma().user.count({ where: { id: other.id } })).toBe(1)
	})

	it('returns 403 FORBIDDEN to an EDITOR who is a member', async () => {
		const app = createTestApp()
		const { user, cookie } = await login(app)
		const { user: other } = await createUser()
		const project = await createProjectRow([user.id, other.id])

		const res = await removeMember(app, cookie, project.id, other.id)

		expectErrorCode(res, 403, ERROR_CODE.FORBIDDEN)
		expect(await getTestPrisma().projectMember.count()).toBe(2)
	})

	it('lets an ADMIN remove the only member', async () => {
		const app = createTestApp()
		const { cookie } = await login(app, ROLE.ADMIN)
		const { user: only } = await createUser()
		const project = await createProjectRow([only.id])

		const res = await removeMember(app, cookie, project.id, only.id)

		expect(res.status).toBe(204)
		expect(await getTestPrisma().projectMember.count()).toBe(0)
	})

	it('returns 403 FORBIDDEN to a MANAGER who is a member', async () => {
		const app = createTestApp()
		const { user, cookie } = await login(app)
		const { user: other } = await createUser()
		const project = await createProjectRow([user.id, other.id], PROJECT_ROLE.MANAGER)

		const res = await removeMember(app, cookie, project.id, other.id)

		expectErrorCode(res, 403, ERROR_CODE.FORBIDDEN)
		expect(await getTestPrisma().projectMember.count()).toBe(2)
	})

	it.each([
		{ name: 'a user who is not a member', userId: () => createUser().then(({ user }) => user.id) },
		{ name: 'an id that is not a UUID', userId: () => Promise.resolve('not-a-uuid') },
	])('returns 404 NOT_FOUND for $name', async ({ userId }) => {
		const app = createTestApp()
		const { cookie } = await login(app, ROLE.ADMIN)
		const project = await createProjectRow([(await createUser()).user.id])

		const res = await removeMember(app, cookie, project.id, await userId())

		expectErrorCode(res, 404, ERROR_CODE.NOT_FOUND)
	})

	it('returns 404 NOT_FOUND to an EDITOR who is not a member of the project', async () => {
		const app = createTestApp()
		const { cookie } = await login(app)
		const { user: first } = await createUser()
		const { user: second } = await createUser()
		const project = await createProjectRow([first.id, second.id])

		const res = await removeMember(app, cookie, project.id, first.id)

		expectErrorCode(res, 404, ERROR_CODE.NOT_FOUND)
		expect(await getTestPrisma().projectMember.count()).toBe(2)
	})

	it('returns 403 CSRF_REJECTED without X-Requested-With', async () => {
		const app = createTestApp()
		const { cookie } = await login(app, ROLE.ADMIN)
		const { user: other } = await createUser()
		const project = await createProjectRow([other.id, (await createUser()).user.id])

		const res = await request(app)
			.delete(`${membersUrl(project.id)}/${other.id}`)
			.set('Cookie', cookie)
			.send({})

		expectErrorCode(res, 403, ERROR_CODE.CSRF_REJECTED)
		expect(await getTestPrisma().projectMember.count()).toBe(2)
	})
})
