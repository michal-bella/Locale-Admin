import request from 'supertest'
import { describe, expect, it } from 'vitest'

import { ERROR_CODE, ROLE, VALIDATION_CODE, errorResponseSchema, projectMemberListResponseSchema, projectMemberSchema } from '@locale/shared'

import { verifyPassword } from '../src/lib/password'

import { createTestApp } from './helpers/app'
import { CSRF_HEADERS, loginAs } from './helpers/auth'
import { getTestPrisma } from './helpers/db'
import { TEST_PASSWORD, createUser } from './helpers/users'

const NEW_PASSWORD = 'NewMemberPassword1'

type App = ReturnType<typeof createTestApp>

const expectErrorCode = (res: request.Response, status: number, code: ERROR_CODE) => {
	expect(res.status).toBe(status)
	expect(errorResponseSchema.parse(res.body).error.code).toBe(code)
}

const login = async (app: App, role: ROLE = ROLE.EDITOR) => {
	const { user } = await createUser({ role })
	return { user, cookie: await loginAs(app, { email: user.email, password: TEST_PASSWORD }) }
}

const createProjectRow = (memberIds: string[] = []) =>
	getTestPrisma().project.create({ data: { name: 'A', slug: 'a', members: { create: memberIds.map((userId) => ({ userId })) } } })

const membersUrl = (projectId: string) => `/api/projects/${projectId}/members`

const postMember = (app: App, cookie: string, projectId: string, body: unknown) =>
	request(app)
		.post(membersUrl(projectId))
		.set('Cookie', cookie)
		.set(CSRF_HEADERS)
		.send(body as object)

describe('GET /api/projects/:projectId/members', () => {
	it('returns the members oldest first without passwordHash or role', async () => {
		const app = createTestApp()
		const { user, cookie } = await login(app)
		const { user: other } = await createUser({ firstName: 'Jana', lastName: 'Nováková' })
		const project = await createProjectRow()
		await getTestPrisma().projectMember.create({ data: { projectId: project.id, userId: user.id, createdAt: new Date('2026-01-01T00:00:00Z') } })
		await getTestPrisma().projectMember.create({ data: { projectId: project.id, userId: other.id, createdAt: new Date('2026-02-01T00:00:00Z') } })

		const res = await request(app).get(membersUrl(project.id)).set('Cookie', cookie)

		expect(res.status).toBe(200)
		const { members } = projectMemberListResponseSchema.extend({ members: projectMemberSchema.strict().array() }).strict().parse(res.body)
		expect(members).toEqual([
			{ id: user.id, email: user.email, firstName: null, lastName: null, createdAt: '2026-01-01T00:00:00.000Z' },
			{ id: other.id, email: other.email, firstName: 'Jana', lastName: 'Nováková', createdAt: '2026-02-01T00:00:00.000Z' },
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
	it.each([ROLE.EDITOR, ROLE.ADMIN])('lets a %s create an EDITOR member who can log in', async (role) => {
		const app = createTestApp()
		const { user, cookie } = await login(app, role)
		const project = await createProjectRow(role === ROLE.EDITOR ? [user.id] : [])

		const res = await postMember(app, cookie, project.id, { email: ' Nova.Osoba@Firma.SK ', password: NEW_PASSWORD, role: ROLE.ADMIN })

		expect(res.status).toBe(201)
		const body = projectMemberSchema.strict().parse(res.body)
		expect(body).toMatchObject({ email: 'nova.osoba@firma.sk', firstName: null, lastName: null })
		const stored = await getTestPrisma().user.findUniqueOrThrow({ where: { id: body.id } })
		expect(stored.role).toBe(ROLE.EDITOR)
		expect(await verifyPassword(stored.passwordHash, NEW_PASSWORD)).toBe(true)
		expect(await getTestPrisma().projectMember.count({ where: { projectId: project.id, userId: body.id } })).toBe(1)

		const loginRes = await request(app).post('/api/auth/login').set(CSRF_HEADERS).send({ email: 'nova.osoba@firma.sk', password: NEW_PASSWORD })
		expect(loginRes.status).toBe(200)
	})

	it('returns 400 VALIDATION_ERROR with details for an invalid body', async () => {
		const app = createTestApp()
		const { user, cookie } = await login(app)
		const project = await createProjectRow([user.id])

		const res = await postMember(app, cookie, project.id, { email: 'not-an-email', password: 'short' })

		expectErrorCode(res, 400, ERROR_CODE.VALIDATION_ERROR)
		expect(errorResponseSchema.parse(res.body).error.details).toEqual([
			{ path: 'email', code: VALIDATION_CODE.INVALID_EMAIL },
			{ path: 'password', code: VALIDATION_CODE.TOO_SHORT, params: { min: 8 } },
		])
	})

	it('returns 409 EMAIL_TAKEN for an existing email and adds no member', async () => {
		const app = createTestApp()
		const { user, cookie } = await login(app)
		const project = await createProjectRow([user.id])
		await createUser({ email: 'existujuci@firma.sk' })

		const res = await postMember(app, cookie, project.id, { email: 'Existujuci@FIRMA.sk', password: NEW_PASSWORD })

		expectErrorCode(res, 409, ERROR_CODE.EMAIL_TAKEN)
		expect(await getTestPrisma().projectMember.count({ where: { projectId: project.id } })).toBe(1)
	})

	it('returns 404 NOT_FOUND to an EDITOR who is not a member and creates no user', async () => {
		const app = createTestApp()
		const { cookie } = await login(app)
		const project = await createProjectRow()

		const res = await postMember(app, cookie, project.id, { email: 'nova.osoba@firma.sk', password: NEW_PASSWORD })

		expectErrorCode(res, 404, ERROR_CODE.NOT_FOUND)
		expect(await getTestPrisma().user.count()).toBe(1)
	})

	it('returns 403 CSRF_REJECTED without X-Requested-With', async () => {
		const app = createTestApp()
		const { user, cookie } = await login(app)
		const project = await createProjectRow([user.id])

		const res = await request(app).post(membersUrl(project.id)).set('Cookie', cookie).send({ email: 'nova.osoba@firma.sk', password: NEW_PASSWORD })

		expectErrorCode(res, 403, ERROR_CODE.CSRF_REJECTED)
		expect(await getTestPrisma().user.count()).toBe(1)
	})
})
