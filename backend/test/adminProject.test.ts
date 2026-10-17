import { randomUUID } from 'node:crypto'

import request from 'supertest'
import { describe, expect, it } from 'vitest'

import { ERROR_CODE, ROLE, VALIDATION_CODE, errorResponseSchema, projectSettingsSchema, type LanguageTag } from '@locale/shared'

import { getSupportedLanguage } from '../src/services/adminLanguages.service'

import { createTestApp } from './helpers/app'
import { CSRF_HEADERS, loginAs } from './helpers/auth'
import { getTestPrisma } from './helpers/db'
import { TEST_PASSWORD, createUser } from './helpers/users'

type App = ReturnType<typeof createTestApp>

const expectErrorCode = (res: request.Response, status: number, code: ERROR_CODE) => {
	expect(res.status).toBe(status)
	expect(errorResponseSchema.parse(res.body).error.code).toBe(code)
}

const loginWithRole = async (app: App, role: ROLE) => {
	const { user } = await createUser({ role })
	return loginAs(app, { email: user.email, password: TEST_PASSWORD })
}

const createLanguageRow = (tag: LanguageTag, { isBase = false }: { isBase?: boolean } = {}) => {
	const { englishName, nativeName, flagCode } = getSupportedLanguage(tag)
	return getTestPrisma().language.create({ data: { tag, englishName, nativeName, flagCode, isBase } })
}

const createProjectRow = () => getTestPrisma().project.create({ data: { name: 'B2B Admin', slug: 'b2b-admin' } })

const patchProject = (app: App, cookie: string, body: unknown) =>
	request(app)
		.patch('/api/admin/project')
		.set('Cookie', cookie)
		.set(CSRF_HEADERS)
		.send(body as object)

const updateBody = (baseLanguageId: string) => ({ name: 'B2C iOS', slug: 'b2c-ios', primaryColor: '#123ABC', protectVariables: false, baseLanguageId })

const getBaseLanguageIds = async () => (await getTestPrisma().language.findMany({ where: { isBase: true } })).map(({ id }) => id)

describe('GET /api/admin/project', () => {
	it('returns the project settings with the base language', async () => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, ROLE.ADMIN)
		const project = await createProjectRow()
		const sk = await createLanguageRow('sk', { isBase: true })
		await createLanguageRow('en')

		const res = await request(app).get('/api/admin/project').set('Cookie', cookie)

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

	it('returns baseLanguageId null without languages', async () => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, ROLE.ADMIN)
		await createProjectRow()

		const res = await request(app).get('/api/admin/project').set('Cookie', cookie)

		expect(res.status).toBe(200)
		expect(projectSettingsSchema.parse(res.body).baseLanguageId).toBeNull()
	})

	it('returns 404 NOT_FOUND without a project', async () => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, ROLE.ADMIN)

		const res = await request(app).get('/api/admin/project').set('Cookie', cookie)

		expectErrorCode(res, 404, ERROR_CODE.NOT_FOUND)
	})

	it('returns 401 AUTH_UNAUTHENTICATED without a session', async () => {
		await createProjectRow()

		const res = await request(createTestApp()).get('/api/admin/project')

		expectErrorCode(res, 401, ERROR_CODE.AUTH_UNAUTHENTICATED)
	})

	it('returns 403 FORBIDDEN for an EDITOR', async () => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, ROLE.EDITOR)
		await createProjectRow()

		const res = await request(app).get('/api/admin/project').set('Cookie', cookie)

		expectErrorCode(res, 403, ERROR_CODE.FORBIDDEN)
	})
})

describe('PATCH /api/admin/project', () => {
	it('saves trimmed values and the color in uppercase', async () => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, ROLE.ADMIN)
		const project = await createProjectRow()
		const sk = await createLanguageRow('sk', { isBase: true })

		const res = await patchProject(app, cookie, {
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
		expect(await getBaseLanguageIds()).toEqual([sk.id])

		const getRes = await request(app).get('/api/admin/project').set('Cookie', cookie)
		expect(getRes.body).toEqual(expected)
	})

	it('moves the base flag to another language', async () => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, ROLE.ADMIN)
		await createProjectRow()
		const sk = await createLanguageRow('sk', { isBase: true })
		const en = await createLanguageRow('en')

		const res = await patchProject(app, cookie, updateBody(en.id))

		expect(res.status).toBe(200)
		expect(projectSettingsSchema.parse(res.body).baseLanguageId).toBe(en.id)
		expect(await getBaseLanguageIds()).toEqual([en.id])
		expect((await getTestPrisma().language.findUniqueOrThrow({ where: { id: sk.id } })).isBase).toBe(false)
	})

	it('returns 400 VALIDATION_ERROR for an unknown baseLanguageId and saves nothing', async () => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, ROLE.ADMIN)
		const project = await createProjectRow()
		const sk = await createLanguageRow('sk', { isBase: true })

		const res = await patchProject(app, cookie, updateBody(randomUUID()))

		expectErrorCode(res, 400, ERROR_CODE.VALIDATION_ERROR)
		expect(errorResponseSchema.parse(res.body).error.details).toEqual([{ path: 'baseLanguageId', code: VALIDATION_CODE.INVALID }])
		expect(await getTestPrisma().project.findUniqueOrThrow({ where: { id: project.id } })).toEqual(project)
		expect(await getBaseLanguageIds()).toEqual([sk.id])
	})

	it('returns 400 VALIDATION_ERROR with details for an invalid body', async () => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, ROLE.ADMIN)
		const project = await createProjectRow()

		const res = await patchProject(app, cookie, { name: ' ', slug: 'B2B', primaryColor: '#FFF', baseLanguageId: 'sk' })

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

	it('returns 404 NOT_FOUND without a project and keeps the base language', async () => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, ROLE.ADMIN)
		const sk = await createLanguageRow('sk', { isBase: true })
		const en = await createLanguageRow('en')

		const res = await patchProject(app, cookie, updateBody(en.id))

		expectErrorCode(res, 404, ERROR_CODE.NOT_FOUND)
		expect(await getBaseLanguageIds()).toEqual([sk.id])
		expect(await getTestPrisma().project.count()).toBe(0)
	})

	it('returns 401 AUTH_UNAUTHENTICATED without a session', async () => {
		const project = await createProjectRow()
		const sk = await createLanguageRow('sk', { isBase: true })

		const res = await request(createTestApp()).patch('/api/admin/project').set(CSRF_HEADERS).send(updateBody(sk.id))

		expectErrorCode(res, 401, ERROR_CODE.AUTH_UNAUTHENTICATED)
		expect(await getTestPrisma().project.findUniqueOrThrow({ where: { id: project.id } })).toEqual(project)
	})

	it('returns 403 FORBIDDEN for an EDITOR', async () => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, ROLE.EDITOR)
		const project = await createProjectRow()
		const sk = await createLanguageRow('sk', { isBase: true })

		const res = await patchProject(app, cookie, updateBody(sk.id))

		expectErrorCode(res, 403, ERROR_CODE.FORBIDDEN)
		expect(await getTestPrisma().project.findUniqueOrThrow({ where: { id: project.id } })).toEqual(project)
	})

	it('returns 403 CSRF_REJECTED without X-Requested-With', async () => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, ROLE.ADMIN)
		const project = await createProjectRow()
		const sk = await createLanguageRow('sk', { isBase: true })

		const res = await request(app).patch('/api/admin/project').set('Cookie', cookie).send(updateBody(sk.id))

		expectErrorCode(res, 403, ERROR_CODE.CSRF_REJECTED)
		expect(await getTestPrisma().project.findUniqueOrThrow({ where: { id: project.id } })).toEqual(project)
	})
})
