import request from 'supertest'
import { describe, expect, it } from 'vitest'

import {
	ERROR_CODE,
	ROLE,
	VALIDATION_CODE,
	adminUserDetailSchema,
	adminUserListResponseSchema,
	adminUserProjectSchema,
	adminUserSchema,
	errorResponseSchema,
} from '@locale/shared'

import { verifyPassword } from '../src/lib/password'

import { createTestApp } from './helpers/app'
import { CSRF_HEADERS, loginAs } from './helpers/auth'
import { getTestPrisma } from './helpers/db'
import { TEST_PASSWORD, createUser } from './helpers/users'

const NEW_PASSWORD = 'NewUserPassword1'

type App = ReturnType<typeof createTestApp>

const expectErrorCode = (res: request.Response, status: number, code: ERROR_CODE) => {
	expect(res.status).toBe(status)
	expect(errorResponseSchema.parse(res.body).error.code).toBe(code)
}

const loginWithRole = async (app: App, role: ROLE) => {
	const { user } = await createUser({ role })
	return loginAs(app, { email: user.email, password: TEST_PASSWORD })
}

const postUser = (app: App, cookie: string, body: unknown) =>
	request(app)
		.post('/api/admin/users')
		.set('Cookie', cookie)
		.set(CSRF_HEADERS)
		.send(body as object)

describe('GET /api/admin/users', () => {
	it('returns every user newest first with their project count and without passwordHash', async () => {
		const app = createTestApp()
		const { user: admin } = await createUser({ role: ROLE.ADMIN, createdAt: new Date('2026-01-01T00:00:00Z') })
		const { user: newer } = await createUser({ role: ROLE.ADMIN, createdAt: new Date('2026-03-01T00:00:00Z') })
		const { user: editor } = await createUser({ createdAt: new Date('2026-04-01T00:00:00Z') })
		await getTestPrisma().project.create({ data: { name: 'A', slug: 'a', members: { create: [{ userId: editor.id }, { userId: newer.id }] } } })
		await getTestPrisma().project.create({ data: { name: 'B', slug: 'b', members: { create: [{ userId: editor.id }] } } })
		const cookie = await loginAs(app, { email: admin.email, password: TEST_PASSWORD })

		const res = await request(app).get('/api/admin/users').set('Cookie', cookie)

		expect(res.status).toBe(200)
		const { users } = adminUserListResponseSchema.parse(res.body)
		expect(users.map(({ id }) => id)).toEqual([editor.id, newer.id, admin.id])
		expect(users.map(({ role, projectCount }) => ({ role, projectCount }))).toEqual([
			{ role: ROLE.EDITOR, projectCount: 2 },
			{ role: ROLE.ADMIN, projectCount: 1 },
			{ role: ROLE.ADMIN, projectCount: 0 },
		])
		expect(users[1]).toEqual({ id: newer.id, email: newer.email, role: ROLE.ADMIN, projectCount: 1, createdAt: '2026-03-01T00:00:00.000Z' })
		expect(adminUserListResponseSchema.extend({ users: adminUserSchema.strict().array() }).strict().safeParse(res.body).success).toBe(true)
		expect(JSON.stringify(res.body)).not.toContain('passwordHash')
	})

	it('returns 401 AUTH_UNAUTHENTICATED without a session', async () => {
		const res = await request(createTestApp()).get('/api/admin/users')

		expectErrorCode(res, 401, ERROR_CODE.AUTH_UNAUTHENTICATED)
	})

	it.each([ROLE.MANAGER, ROLE.EDITOR])('returns 403 FORBIDDEN for a %s', async (role) => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, role)

		const res = await request(app).get('/api/admin/users').set('Cookie', cookie)

		expectErrorCode(res, 403, ERROR_CODE.FORBIDDEN)
	})
})

describe('GET /api/admin/users/:id', () => {
	const getUser = (app: App, cookie: string, id: string) => request(app).get(`/api/admin/users/${id}`).set('Cookie', cookie)

	it('returns the user with their projects sorted by name and without passwordHash', async () => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, ROLE.ADMIN)
		const { user: editor } = await createUser({ createdAt: new Date('2026-04-01T00:00:00Z') })
		const { user: other } = await createUser()
		const prisma = getTestPrisma()
		const zeta = await prisma.project.create({ data: { name: 'Zeta', slug: 'zeta', primaryColor: '#123456' } })
		const alpha = await prisma.project.create({ data: { name: 'Alpha', slug: 'alpha' } })
		await prisma.project.create({ data: { name: 'Other', slug: 'other', members: { create: { userId: other.id } } } })
		await prisma.projectMember.create({ data: { projectId: zeta.id, userId: editor.id, createdAt: new Date('2026-05-01T00:00:00Z') } })
		await prisma.projectMember.create({ data: { projectId: alpha.id, userId: editor.id, createdAt: new Date('2026-06-01T00:00:00Z') } })

		const res = await getUser(app, cookie, editor.id)

		expect(res.status).toBe(200)
		expect(res.body).toEqual({
			id: editor.id,
			email: editor.email,
			role: ROLE.EDITOR,
			projectCount: 2,
			createdAt: '2026-04-01T00:00:00.000Z',
			projects: [
				{ id: alpha.id, name: 'Alpha', slug: 'alpha', primaryColor: '#E83E8C', joinedAt: '2026-06-01T00:00:00.000Z' },
				{ id: zeta.id, name: 'Zeta', slug: 'zeta', primaryColor: '#123456', joinedAt: '2026-05-01T00:00:00.000Z' },
			],
		})
		expect(adminUserDetailSchema.extend({ projects: adminUserProjectSchema.strict().array() }).strict().safeParse(res.body).success).toBe(true)
		expect(JSON.stringify(res.body)).not.toContain('passwordHash')
	})

	it('returns an admin without projects with an empty list', async () => {
		const app = createTestApp()
		const { user: admin } = await createUser({ role: ROLE.ADMIN })
		const cookie = await loginAs(app, { email: admin.email, password: TEST_PASSWORD })

		const res = await getUser(app, cookie, admin.id)

		expect(res.status).toBe(200)
		expect(res.body).toMatchObject({ id: admin.id, role: ROLE.ADMIN, projectCount: 0, projects: [] })
	})

	it.each([
		{ name: 'an unknown id', id: '00000000-0000-4000-8000-000000000999' },
		{ name: 'an id that is not a UUID', id: 'not-a-uuid' },
	])('returns 404 NOT_FOUND for $name', async ({ id }) => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, ROLE.ADMIN)

		const res = await getUser(app, cookie, id)

		expectErrorCode(res, 404, ERROR_CODE.NOT_FOUND)
	})

	it('returns 401 AUTH_UNAUTHENTICATED without a session', async () => {
		const { user } = await createUser()

		const res = await request(createTestApp()).get(`/api/admin/users/${user.id}`)

		expectErrorCode(res, 401, ERROR_CODE.AUTH_UNAUTHENTICATED)
	})

	it('returns 403 FORBIDDEN for an EDITOR, also for their own id', async () => {
		const app = createTestApp()
		const { user } = await createUser()
		const cookie = await loginAs(app, { email: user.email, password: TEST_PASSWORD })

		const res = await getUser(app, cookie, user.id)

		expectErrorCode(res, 403, ERROR_CODE.FORBIDDEN)
	})
})

describe('POST /api/admin/users', () => {
	it.each(Object.values(ROLE))('creates a %s with a normalized email', async (role) => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, ROLE.ADMIN)
		const before = Date.now()

		const res = await postUser(app, cookie, { email: '  Nova.Osoba@Firma.SK ', password: NEW_PASSWORD, role })

		expect(res.status).toBe(201)
		const body = adminUserSchema.strict().parse(res.body)
		expect(body).toMatchObject({ email: 'nova.osoba@firma.sk', role, projectCount: 0 })

		const stored = await getTestPrisma().user.findUniqueOrThrow({ where: { id: body.id } })
		expect(stored).toMatchObject({ email: 'nova.osoba@firma.sk', role, isActive: true })
		expect(stored.passwordHash).toMatch(/^\$argon2id\$/)
		expect(await verifyPassword(stored.passwordHash, NEW_PASSWORD)).toBe(true)
		expect(stored.passwordChangedAt.getTime()).toBeGreaterThanOrEqual(before - 1000)
		expect(body.createdAt).toBe(stored.createdAt.toISOString())
	})

	it('creates a user who can log in', async () => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, ROLE.ADMIN)
		await postUser(app, cookie, { email: 'nova.osoba@firma.sk', password: NEW_PASSWORD, role: ROLE.EDITOR }).expect(201)

		const res = await request(app).post('/api/auth/login').set(CSRF_HEADERS).send({ email: 'NOVA.osoba@firma.sk', password: NEW_PASSWORD })

		expect(res.status).toBe(200)
		expect(res.body).toMatchObject({ email: 'nova.osoba@firma.sk', role: ROLE.EDITOR })
	})

	it.each([
		{
			name: 'invalid email',
			body: { email: 'not-an-email', password: NEW_PASSWORD, role: ROLE.EDITOR },
			details: [{ path: 'email', code: VALIDATION_CODE.INVALID_EMAIL }],
		},
		{
			name: 'short password',
			body: { email: 'nova.osoba@firma.sk', password: 'short', role: ROLE.EDITOR },
			details: [{ path: 'password', code: VALIDATION_CODE.TOO_SHORT, params: { min: 8 } }],
		},
		{
			name: 'unknown role',
			body: { email: 'nova.osoba@firma.sk', password: NEW_PASSWORD, role: 'OWNER' },
			details: [{ path: 'role', code: VALIDATION_CODE.INVALID }],
		},
		{
			name: 'missing fields',
			body: {},
			details: [
				{ path: 'email', code: VALIDATION_CODE.REQUIRED },
				{ path: 'password', code: VALIDATION_CODE.REQUIRED },
				{ path: 'role', code: VALIDATION_CODE.INVALID },
			],
		},
	])('returns 400 VALIDATION_ERROR with details for $name', async ({ body, details }) => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, ROLE.ADMIN)

		const res = await postUser(app, cookie, body)

		expectErrorCode(res, 400, ERROR_CODE.VALIDATION_ERROR)
		expect(errorResponseSchema.parse(res.body).error.details).toEqual(details)
		expect(await getTestPrisma().user.count()).toBe(1)
	})

	it('returns 409 EMAIL_TAKEN for an existing email in different case', async () => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, ROLE.ADMIN)
		await createUser({ email: 'existujuci@firma.sk' })

		const res = await postUser(app, cookie, { email: 'Existujuci@FIRMA.sk', password: NEW_PASSWORD, role: ROLE.EDITOR })

		expectErrorCode(res, 409, ERROR_CODE.EMAIL_TAKEN)
		expect(await getTestPrisma().user.count({ where: { email: 'existujuci@firma.sk' } })).toBe(1)
	})

	it('returns 409 EMAIL_TAKEN for one of two concurrent requests with the same email', async () => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, ROLE.ADMIN)

		const responses = await Promise.all([
			postUser(app, cookie, { email: 'subeh@firma.sk', password: NEW_PASSWORD, role: ROLE.EDITOR }),
			postUser(app, cookie, { email: 'subeh@firma.sk', password: NEW_PASSWORD, role: ROLE.EDITOR }),
		])

		expect(responses.map(({ status }) => status).sort()).toEqual([201, 409])
		expectErrorCode(responses.find(({ status }) => status === 409) as request.Response, 409, ERROR_CODE.EMAIL_TAKEN)
	})

	it('returns 401 AUTH_UNAUTHENTICATED without a session', async () => {
		const res = await request(createTestApp())
			.post('/api/admin/users')
			.set(CSRF_HEADERS)
			.send({ email: 'nova.osoba@firma.sk', password: NEW_PASSWORD, role: ROLE.EDITOR })

		expectErrorCode(res, 401, ERROR_CODE.AUTH_UNAUTHENTICATED)
		expect(await getTestPrisma().user.count()).toBe(0)
	})

	it('returns 403 FORBIDDEN for an EDITOR', async () => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, ROLE.EDITOR)

		const res = await postUser(app, cookie, { email: 'nova.osoba@firma.sk', password: NEW_PASSWORD, role: ROLE.EDITOR })

		expectErrorCode(res, 403, ERROR_CODE.FORBIDDEN)
		expect(await getTestPrisma().user.count()).toBe(1)
	})

	it('returns 403 CSRF_REJECTED without X-Requested-With', async () => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, ROLE.ADMIN)

		const res = await request(app)
			.post('/api/admin/users')
			.set('Cookie', cookie)
			.send({ email: 'nova.osoba@firma.sk', password: NEW_PASSWORD, role: ROLE.EDITOR })

		expectErrorCode(res, 403, ERROR_CODE.CSRF_REJECTED)
		expect(await getTestPrisma().user.count()).toBe(1)
	})
})

describe('PATCH /api/admin/users/:id', () => {
	const patchUser = (app: App, cookie: string, id: string, body: unknown) =>
		request(app)
			.patch(`/api/admin/users/${id}`)
			.set('Cookie', cookie)
			.set(CSRF_HEADERS)
			.send(body as object)

	it('changes the role of another user and returns the detail', async () => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, ROLE.ADMIN)
		const { user: editor } = await createUser()
		await getTestPrisma().project.create({ data: { name: 'A', slug: 'a', members: { create: { userId: editor.id } } } })

		const res = await patchUser(app, cookie, editor.id, { role: ROLE.MANAGER })

		expect(res.status).toBe(200)
		const detail = adminUserDetailSchema.parse(res.body)
		expect(detail).toMatchObject({ id: editor.id, role: ROLE.MANAGER, projectCount: 1 })
		expect(detail.projects.map((project) => project.slug)).toEqual(['a'])
		expect((await getTestPrisma().user.findUniqueOrThrow({ where: { id: editor.id } })).role).toBe(ROLE.MANAGER)
	})

	it('drops the project memberships of a user who becomes an ADMIN', async () => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, ROLE.ADMIN)
		const { user: editor } = await createUser()
		await getTestPrisma().project.create({ data: { name: 'A', slug: 'a', members: { create: { userId: editor.id } } } })

		const res = await patchUser(app, cookie, editor.id, { role: ROLE.ADMIN })

		expect(res.status).toBe(200)
		expect(adminUserDetailSchema.parse(res.body)).toMatchObject({ id: editor.id, role: ROLE.ADMIN, projectCount: 0, projects: [] })
		expect(await getTestPrisma().project.count()).toBe(1)
	})

	it('demotes an admin when another admin stays, the own account included', async () => {
		const app = createTestApp()
		const { user: me } = await createUser({ role: ROLE.ADMIN })
		const cookie = await loginAs(app, { email: me.email, password: TEST_PASSWORD })
		const { user: other } = await createUser({ role: ROLE.ADMIN })

		expect((await patchUser(app, cookie, other.id, { role: ROLE.EDITOR })).body).toMatchObject({ role: ROLE.EDITOR })
		await patchUser(app, cookie, other.id, { role: ROLE.ADMIN }).expect(200)
		expect((await patchUser(app, cookie, me.id, { role: ROLE.EDITOR })).body).toMatchObject({ role: ROLE.EDITOR })
		expect((await request(app).get('/api/auth/me').set('Cookie', cookie)).body).toMatchObject({ role: ROLE.EDITOR })
	})

	it.each([ROLE.EDITOR, ROLE.VISITOR])('returns 409 LAST_ADMIN when the only admin would become a %s and keeps the role', async (role) => {
		const app = createTestApp()
		const { user: admin } = await createUser({ role: ROLE.ADMIN })
		const cookie = await loginAs(app, { email: admin.email, password: TEST_PASSWORD })

		const res = await patchUser(app, cookie, admin.id, { role })

		expectErrorCode(res, 409, ERROR_CODE.LAST_ADMIN)
		expect((await getTestPrisma().user.findUniqueOrThrow({ where: { id: admin.id } })).role).toBe(ROLE.ADMIN)
		await patchUser(app, cookie, admin.id, { role: ROLE.ADMIN }).expect(200)
	})

	it('returns 400 VALIDATION_ERROR for an unknown or missing role', async () => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, ROLE.ADMIN)
		const { user: editor } = await createUser()

		const res = await patchUser(app, cookie, editor.id, { role: 'OWNER' })

		expectErrorCode(res, 400, ERROR_CODE.VALIDATION_ERROR)
		expect(errorResponseSchema.parse(res.body).error.details).toEqual([{ path: 'role', code: VALIDATION_CODE.INVALID }])
		expectErrorCode(await patchUser(app, cookie, editor.id, {}), 400, ERROR_CODE.VALIDATION_ERROR)
	})

	it('changes the email normalized, keeps the role and lets the user sign in with the new email only', async () => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, ROLE.ADMIN)
		const { user: editor } = await createUser()

		const res = await patchUser(app, cookie, editor.id, { email: '  New.Mail@Example.com ' })

		expect(res.status).toBe(200)
		expect(adminUserDetailSchema.parse(res.body)).toMatchObject({ id: editor.id, email: 'new.mail@example.com', role: ROLE.EDITOR })
		const login = (email: string) => request(app).post('/api/auth/login').set(CSRF_HEADERS).send({ email, password: TEST_PASSWORD })
		expect((await login('new.mail@example.com')).status).toBe(200)
		expect((await login(editor.email)).status).toBe(401)
	})

	it('changes the role and the email together', async () => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, ROLE.ADMIN)
		const { user: editor } = await createUser()

		const res = await patchUser(app, cookie, editor.id, { role: ROLE.ADMIN, email: 'both@example.com' })

		expect(res.body).toMatchObject({ email: 'both@example.com', role: ROLE.ADMIN })
	})

	it('returns 409 EMAIL_TAKEN for the email of another user and 400 for an invalid email, changing nothing', async () => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, ROLE.ADMIN)
		const { user: editor } = await createUser()
		const { user: other } = await createUser()

		expectErrorCode(await patchUser(app, cookie, editor.id, { email: other.email.toUpperCase(), role: ROLE.ADMIN }), 409, ERROR_CODE.EMAIL_TAKEN)
		const invalid = await patchUser(app, cookie, editor.id, { email: 'no-at-sign' })
		expectErrorCode(invalid, 400, ERROR_CODE.VALIDATION_ERROR)
		expect(errorResponseSchema.parse(invalid.body).error.details).toEqual([{ path: 'email', code: VALIDATION_CODE.INVALID_EMAIL }])
		expect(await getTestPrisma().user.findUniqueOrThrow({ where: { id: editor.id }, select: { email: true, role: true } })).toEqual({
			email: editor.email,
			role: ROLE.EDITOR,
		})
	})

	it('returns 404 NOT_FOUND for an unknown id and a non-UUID', async () => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, ROLE.ADMIN)

		expectErrorCode(await patchUser(app, cookie, '00000000-0000-4000-8000-000000000000', { role: ROLE.ADMIN }), 404, ERROR_CODE.NOT_FOUND)
		expectErrorCode(await patchUser(app, cookie, 'not-a-uuid', { role: ROLE.ADMIN }), 404, ERROR_CODE.NOT_FOUND)
	})

	it('returns 403 FORBIDDEN for an EDITOR and 403 CSRF_REJECTED without X-Requested-With', async () => {
		const app = createTestApp()
		const editorCookie = await loginWithRole(app, ROLE.EDITOR)
		const { user: target } = await createUser()

		expectErrorCode(await patchUser(app, editorCookie, target.id, { role: ROLE.ADMIN }), 403, ERROR_CODE.FORBIDDEN)

		const adminCookie = await loginWithRole(app, ROLE.ADMIN)
		const res = await request(app).patch(`/api/admin/users/${target.id}`).set('Cookie', adminCookie).send({ role: ROLE.ADMIN })
		expectErrorCode(res, 403, ERROR_CODE.CSRF_REJECTED)
		expect((await getTestPrisma().user.findUniqueOrThrow({ where: { id: target.id } })).role).toBe(ROLE.EDITOR)
	})
})

describe('DELETE /api/admin/users/:id', () => {
	const deleteUser = (app: App, cookie: string, id: string) => request(app).delete(`/api/admin/users/${id}`).set('Cookie', cookie).set(CSRF_HEADERS).send({})

	it('deletes another admin with their sessions and project memberships', async () => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, ROLE.ADMIN)
		const { user: other } = await createUser({ role: ROLE.ADMIN })
		const otherCookie = await loginAs(app, { email: other.email, password: TEST_PASSWORD })
		await getTestPrisma().project.create({ data: { name: 'A', slug: 'a', members: { create: { userId: other.id } } } })

		const res = await deleteUser(app, cookie, other.id)

		expect(res.status).toBe(204)
		expect(await getTestPrisma().user.count({ where: { id: other.id } })).toBe(0)
		expect(await getTestPrisma().projectMember.count()).toBe(0)
		expect((await request(app).get('/api/auth/me').set('Cookie', otherCookie)).status).toBe(401)
	})

	it('returns 409 SELF_DELETE for the own account', async () => {
		const app = createTestApp()
		const { user: admin } = await createUser({ role: ROLE.ADMIN })
		const cookie = await loginAs(app, { email: admin.email, password: TEST_PASSWORD })

		const res = await deleteUser(app, cookie, admin.id)

		expectErrorCode(res, 409, ERROR_CODE.SELF_DELETE)
		expect(await getTestPrisma().user.count({ where: { id: admin.id } })).toBe(1)
	})

	it('deletes an EDITOR with their project memberships and keeps the projects', async () => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, ROLE.ADMIN)
		const { user: editor } = await createUser()
		const project = await getTestPrisma().project.create({ data: { name: 'A', slug: 'a', members: { create: { userId: editor.id } } } })

		const res = await deleteUser(app, cookie, editor.id)

		expect(res.status).toBe(204)
		expect(await getTestPrisma().user.count({ where: { id: editor.id } })).toBe(0)
		expect(await getTestPrisma().projectMember.count({ where: { projectId: project.id } })).toBe(0)
		expect(await getTestPrisma().project.count({ where: { id: project.id } })).toBe(1)
	})

	it.each([
		{ name: 'an unknown id', id: () => Promise.resolve('00000000-0000-4000-8000-000000000999') },
		{ name: 'an id that is not a UUID', id: () => Promise.resolve('not-a-uuid') },
	])('returns 404 NOT_FOUND for $name', async ({ id }) => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, ROLE.ADMIN)
		const target = await id()
		const usersBefore = await getTestPrisma().user.count()

		const res = await deleteUser(app, cookie, target)

		expectErrorCode(res, 404, ERROR_CODE.NOT_FOUND)
		expect(await getTestPrisma().user.count()).toBe(usersBefore)
	})

	it('returns 403 FORBIDDEN for an EDITOR', async () => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, ROLE.EDITOR)
		const { user: admin } = await createUser({ role: ROLE.ADMIN })

		const res = await deleteUser(app, cookie, admin.id)

		expectErrorCode(res, 403, ERROR_CODE.FORBIDDEN)
		expect(await getTestPrisma().user.count({ where: { id: admin.id } })).toBe(1)
	})

	it('returns 403 CSRF_REJECTED without X-Requested-With', async () => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, ROLE.ADMIN)
		const { user: other } = await createUser({ role: ROLE.ADMIN })

		const res = await request(app).delete(`/api/admin/users/${other.id}`).set('Cookie', cookie).send({})

		expectErrorCode(res, 403, ERROR_CODE.CSRF_REJECTED)
		expect(await getTestPrisma().user.count({ where: { id: other.id } })).toBe(1)
	})
})
