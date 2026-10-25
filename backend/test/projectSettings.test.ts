import { randomUUID } from 'node:crypto'

import request from 'supertest'
import { describe, expect, it } from 'vitest'

import { ERROR_CODE, ROLE, VALIDATION_CODE, errorResponseSchema, projectSettingsSchema, type LanguageTag } from '@locale/shared'

import { createTestApp } from './helpers/app'
import { CSRF_HEADERS, loginAs } from './helpers/auth'
import { getTestPrisma } from './helpers/db'
import { TEST_PASSWORD, createUser } from './helpers/users'

type App = ReturnType<typeof createTestApp>

const expectErrorCode = (res: request.Response, status: number, code: ERROR_CODE) => {
	expect(res.status).toBe(status)
	expect(errorResponseSchema.parse(res.body).error.code).toBe(code)
}

/** Logs in a new user; an EDITOR is a member of `memberOf` when given. */
const loginWithRole = async (app: App, role: ROLE, memberOf?: string) => {
	const { user } = await createUser({ role })
	if (memberOf) {
		await getTestPrisma().projectMember.create({ data: { projectId: memberOf, userId: user.id } })
	}
	return loginAs(app, { email: user.email, password: TEST_PASSWORD })
}

const createLanguageRow = (projectId: string, tag: LanguageTag, { isBase = false }: { isBase?: boolean } = {}) =>
	getTestPrisma().projectLanguage.create({ data: { projectId, tag, isBase } })

const createProjectRow = (slug = 'b2b-admin') => getTestPrisma().project.create({ data: { name: 'B2B Admin', slug } })

const settingsUrl = (projectId: string) => `/api/projects/${projectId}/settings`

const patchProject = (app: App, cookie: string, projectId: string, body: unknown) =>
	request(app)
		.patch(settingsUrl(projectId))
		.set('Cookie', cookie)
		.set(CSRF_HEADERS)
		.send(body as object)

const updateBody = (baseLanguageId?: string) => ({ name: 'B2C iOS', slug: 'b2c-ios', primaryColor: '#123ABC', protectVariables: false, baseLanguageId })

const getBaseLanguageIds = async (projectId: string) =>
	(await getTestPrisma().projectLanguage.findMany({ where: { projectId, isBase: true } })).map(({ id }) => id)

describe('GET /api/projects/:projectId/settings', () => {
	it('returns the project settings with the base language to a member', async () => {
		const app = createTestApp()
		const project = await createProjectRow()
		const cookie = await loginWithRole(app, ROLE.EDITOR, project.id)
		const sk = await createLanguageRow(project.id, 'sk', { isBase: true })
		await createLanguageRow(project.id, 'en')

		const res = await request(app).get(settingsUrl(project.id)).set('Cookie', cookie)

		expect(res.status).toBe(200)
		expect(projectSettingsSchema.strict().parse(res.body)).toEqual({
			id: project.id,
			name: 'B2B Admin',
			slug: 'b2b-admin',
			primaryColor: '#E83E8C',
			protectVariables: true,
			baseLanguageId: sk.id,
		})
	})

	it('returns the settings to an ADMIN who is not a member, with baseLanguageId null without languages', async () => {
		const app = createTestApp()
		const project = await createProjectRow()
		const cookie = await loginWithRole(app, ROLE.ADMIN)

		const res = await request(app).get(settingsUrl(project.id)).set('Cookie', cookie)

		expect(res.status).toBe(200)
		expect(projectSettingsSchema.parse(res.body).baseLanguageId).toBeNull()
	})

	it.each([
		{ name: 'an EDITOR who is not a member', role: ROLE.EDITOR, projectId: undefined },
		{ name: 'an unknown project', role: ROLE.ADMIN, projectId: randomUUID() },
		{ name: 'an id that is not a UUID', role: ROLE.ADMIN, projectId: 'b2b-admin' },
	])('returns 404 NOT_FOUND for $name', async ({ role, projectId }) => {
		const app = createTestApp()
		const project = await createProjectRow()
		const cookie = await loginWithRole(app, role)

		const res = await request(app)
			.get(settingsUrl(projectId ?? project.id))
			.set('Cookie', cookie)

		expectErrorCode(res, 404, ERROR_CODE.NOT_FOUND)
	})

	it('returns 401 AUTH_UNAUTHENTICATED without a session', async () => {
		const project = await createProjectRow()

		const res = await request(createTestApp()).get(settingsUrl(project.id))

		expectErrorCode(res, 401, ERROR_CODE.AUTH_UNAUTHENTICATED)
	})
})

describe('PATCH /api/projects/:projectId/settings', () => {
	it('saves trimmed values and the color in uppercase', async () => {
		const app = createTestApp()
		const project = await createProjectRow()
		const cookie = await loginWithRole(app, ROLE.ADMIN)
		const sk = await createLanguageRow(project.id, 'sk', { isBase: true })

		const res = await patchProject(app, cookie, project.id, {
			name: '  B2C iOS ',
			slug: ' b2c-ios ',
			primaryColor: ' #12ab9f ',
			protectVariables: false,
			baseLanguageId: sk.id,
		})

		expect(res.status).toBe(200)
		const expected = { id: project.id, name: 'B2C iOS', slug: 'b2c-ios', primaryColor: '#12AB9F', protectVariables: false, baseLanguageId: sk.id }
		expect(projectSettingsSchema.strict().parse(res.body)).toEqual(expected)
		expect(await getTestPrisma().project.findUniqueOrThrow({ where: { id: project.id } })).toMatchObject({
			name: 'B2C iOS',
			slug: 'b2c-ios',
			primaryColor: '#12AB9F',
			protectVariables: false,
		})
		expect(await getBaseLanguageIds(project.id)).toEqual([sk.id])

		const getRes = await request(app).get(settingsUrl(project.id)).set('Cookie', cookie)
		expect(getRes.body).toEqual(expected)
	})

	it('saves without the base language or with the current one', async () => {
		const app = createTestApp()
		const project = await createProjectRow()
		const cookie = await loginWithRole(app, ROLE.ADMIN)
		const sk = await createLanguageRow(project.id, 'sk', { isBase: true })

		const withoutBase = await patchProject(app, cookie, project.id, updateBody())
		const withCurrentBase = await patchProject(app, cookie, project.id, { ...updateBody(sk.id), name: 'B2C Android' })

		expect(withoutBase.status).toBe(200)
		expect(projectSettingsSchema.parse(withoutBase.body)).toMatchObject({ name: 'B2C iOS', baseLanguageId: sk.id })
		expect(withCurrentBase.status).toBe(200)
		expect(projectSettingsSchema.parse(withCurrentBase.body)).toMatchObject({ name: 'B2C Android', baseLanguageId: sk.id })
	})

	it('moves the base flag to another language of the project', async () => {
		const app = createTestApp()
		const project = await createProjectRow()
		const cookie = await loginWithRole(app, ROLE.ADMIN)
		const sk = await createLanguageRow(project.id, 'sk', { isBase: true })
		const en = await createLanguageRow(project.id, 'en')

		const res = await patchProject(app, cookie, project.id, updateBody(en.id))

		expect(res.status).toBe(200)
		expect(projectSettingsSchema.parse(res.body).baseLanguageId).toBe(en.id)
		expect(await getBaseLanguageIds(project.id)).toEqual([en.id])
		expect((await getTestPrisma().projectLanguage.findUniqueOrThrow({ where: { id: sk.id } })).isBase).toBe(false)
	})

	it('returns 400 VALIDATION_ERROR for a language of another project and keeps both bases', async () => {
		const app = createTestApp()
		const project = await createProjectRow()
		const other = await createProjectRow('b2c-ios')
		const cookie = await loginWithRole(app, ROLE.ADMIN)
		const sk = await createLanguageRow(project.id, 'sk', { isBase: true })
		const foreign = await createLanguageRow(other.id, 'en', { isBase: true })

		const res = await patchProject(app, cookie, project.id, updateBody(foreign.id))

		expectErrorCode(res, 400, ERROR_CODE.VALIDATION_ERROR)
		expect(errorResponseSchema.parse(res.body).error.details).toEqual([{ path: 'baseLanguageId', code: VALIDATION_CODE.INVALID }])
		expect(await getBaseLanguageIds(project.id)).toEqual([sk.id])
		expect(await getBaseLanguageIds(other.id)).toEqual([foreign.id])
	})

	it('returns 400 VALIDATION_ERROR for an unknown baseLanguageId and saves nothing', async () => {
		const app = createTestApp()
		const project = await createProjectRow()
		const cookie = await loginWithRole(app, ROLE.ADMIN)
		const sk = await createLanguageRow(project.id, 'sk', { isBase: true })

		const res = await patchProject(app, cookie, project.id, updateBody(randomUUID()))

		expectErrorCode(res, 400, ERROR_CODE.VALIDATION_ERROR)
		expect(errorResponseSchema.parse(res.body).error.details).toEqual([{ path: 'baseLanguageId', code: VALIDATION_CODE.INVALID }])
		expect(await getTestPrisma().project.findUniqueOrThrow({ where: { id: project.id } })).toEqual(project)
		expect(await getBaseLanguageIds(project.id)).toEqual([sk.id])
	})

	it('returns 400 VALIDATION_ERROR with details for an invalid body', async () => {
		const app = createTestApp()
		const project = await createProjectRow()
		const cookie = await loginWithRole(app, ROLE.ADMIN)

		const res = await patchProject(app, cookie, project.id, { name: ' ', slug: 'B2B', primaryColor: '#FFF', baseLanguageId: 'sk' })

		expectErrorCode(res, 400, ERROR_CODE.VALIDATION_ERROR)
		expect(errorResponseSchema.parse(res.body).error.details).toEqual([
			{ path: 'name', code: VALIDATION_CODE.REQUIRED },
			{ path: 'slug', code: VALIDATION_CODE.INVALID },
			{ path: 'primaryColor', code: VALIDATION_CODE.INVALID },
			{ path: 'protectVariables', code: VALIDATION_CODE.REQUIRED },
			{ path: 'baseLanguageId', code: VALIDATION_CODE.INVALID },
		])
		expect(await getTestPrisma().project.findUniqueOrThrow({ where: { id: project.id } })).toEqual(project)
	})

	it('returns 409 SLUG_TAKEN for the slug of another project', async () => {
		const app = createTestApp()
		const project = await createProjectRow()
		await createProjectRow('b2c-ios')
		const cookie = await loginWithRole(app, ROLE.ADMIN)

		const res = await patchProject(app, cookie, project.id, updateBody())

		expectErrorCode(res, 409, ERROR_CODE.SLUG_TAKEN)
		expect(await getTestPrisma().project.findUniqueOrThrow({ where: { id: project.id } })).toEqual(project)
	})

	it('lets a MANAGER member save the settings', async () => {
		const app = createTestApp()
		const project = await createProjectRow()
		const cookie = await loginWithRole(app, ROLE.MANAGER, project.id)

		const res = await patchProject(app, cookie, project.id, updateBody())

		expect(res.status).toBe(200)
		expect(await getTestPrisma().project.findUniqueOrThrow({ where: { id: project.id } })).toMatchObject({ name: 'B2C iOS', slug: 'b2c-ios' })
	})

	it('returns 404 NOT_FOUND for a MANAGER who is not a member', async () => {
		const app = createTestApp()
		const project = await createProjectRow()
		const cookie = await loginWithRole(app, ROLE.MANAGER)

		const res = await patchProject(app, cookie, project.id, updateBody())

		expectErrorCode(res, 404, ERROR_CODE.NOT_FOUND)
	})

	it('returns 403 FORBIDDEN for an EDITOR member and saves nothing', async () => {
		const app = createTestApp()
		const project = await createProjectRow()
		const cookie = await loginWithRole(app, ROLE.EDITOR, project.id)

		const res = await patchProject(app, cookie, project.id, updateBody())

		expectErrorCode(res, 403, ERROR_CODE.FORBIDDEN)
		expect(await getTestPrisma().project.findUniqueOrThrow({ where: { id: project.id } })).toEqual(project)
	})

	it('returns 404 NOT_FOUND for an EDITOR who is not a member', async () => {
		const app = createTestApp()
		const project = await createProjectRow()
		const cookie = await loginWithRole(app, ROLE.EDITOR)

		const res = await patchProject(app, cookie, project.id, updateBody())

		expectErrorCode(res, 404, ERROR_CODE.NOT_FOUND)
		expect(await getTestPrisma().project.findUniqueOrThrow({ where: { id: project.id } })).toEqual(project)
	})

	it('returns 401 AUTH_UNAUTHENTICATED without a session', async () => {
		const project = await createProjectRow()

		const res = await request(createTestApp()).patch(settingsUrl(project.id)).set(CSRF_HEADERS).send(updateBody())

		expectErrorCode(res, 401, ERROR_CODE.AUTH_UNAUTHENTICATED)
		expect(await getTestPrisma().project.findUniqueOrThrow({ where: { id: project.id } })).toEqual(project)
	})

	it('returns 403 CSRF_REJECTED without X-Requested-With', async () => {
		const app = createTestApp()
		const project = await createProjectRow()
		const cookie = await loginWithRole(app, ROLE.ADMIN)

		const res = await request(app).patch(settingsUrl(project.id)).set('Cookie', cookie).send(updateBody())

		expectErrorCode(res, 403, ERROR_CODE.CSRF_REJECTED)
		expect(await getTestPrisma().project.findUniqueOrThrow({ where: { id: project.id } })).toEqual(project)
	})
})
