import { randomUUID } from 'node:crypto'

import request from 'supertest'
import { describe, expect, it } from 'vitest'

import {
	ERROR_CODE,
	ROLE,
	errorResponseSchema,
	translationsResponseSchema,
	updateTranslationKeyResponseSchema,
	type UpdateTranslationKeyRequestInput,
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

const createProject = (members: string[] = []) =>
	getTestPrisma().project.create({ data: { name: 'A', slug: `a-${randomUUID().slice(0, 8)}`, members: { create: members.map((userId) => ({ userId })) } } })

const createLanguage = (projectId: string, tag: string, isBase = false) => getTestPrisma().projectLanguage.create({ data: { projectId, tag, isBase } })

type KeyOptions = { namespace?: string; values?: Record<string, string | null>; pluralVariable?: string | null; description?: string | null }

const createKey = (projectId: string, name: string, { namespace = 'loc', values = {}, pluralVariable = null, description = null }: KeyOptions = {}) =>
	getTestPrisma().translationKey.create({
		data: {
			projectId,
			namespace,
			name,
			pluralVariable,
			description,
			translations: { create: Object.entries(values).map(([languageId, value]) => ({ languageId, value })) },
		},
	})

/** Logs in a new user (ADMIN member by default) with a new project with `sk` (base) and `en`. */
const setup = async (app: App, { role = ROLE.ADMIN, member = true } = {}) => {
	const { user } = await createUser({ role })
	const project = await createProject(member ? [user.id] : [])
	const sk = await createLanguage(project.id, 'sk', true)
	const en = await createLanguage(project.id, 'en')
	return { user, project, sk, en, cookie: await loginAs(app, { email: user.email, password: TEST_PASSWORD }) }
}

const patch = (app: App, cookie: string, projectId: string, keyId: string, body: UpdateTranslationKeyRequestInput | Record<string, unknown>) =>
	request(app).patch(`/api/projects/${projectId}/keys/${keyId}`).set('Cookie', cookie).set(CSRF_HEADERS).send(body)

const patchOk = async (...args: Parameters<typeof patch>) => {
	const res = await patch(...args)
	expect(res.status).toBe(200)
	return updateTranslationKeyResponseSchema.strict().parse(res.body)
}

const findKey = (keyId: string) => getTestPrisma().translationKey.findUniqueOrThrow({ where: { id: keyId } })

const values = async (keyId: string) => {
	const rows = await getTestPrisma().translation.findMany({ where: { keyId }, select: { languageId: true, value: true } })
	return Object.fromEntries(rows.map((row) => [row.languageId, row.value]))
}

const updatedBy = async (keyId: string) => {
	const rows = await getTestPrisma().translation.findMany({ where: { keyId }, select: { languageId: true, updatedById: true } })
	return Object.fromEntries(rows.map((row) => [row.languageId, row.updatedById]))
}

const list = async (app: App, cookie: string, projectId: string, sourceLanguageId: string, targetLanguageId: string) => {
	const res = await request(app).get(`/api/projects/${projectId}/translations`).query({ sourceLanguageId, targetLanguageId }).set('Cookie', cookie)
	expect(res.status).toBe(200)
	return translationsResponseSchema.parse(res.body)
}

describe('PATCH /api/projects/:projectId/keys/:keyId', () => {
	it('renames a key, recomputes the group and the list reflects it', async () => {
		const app = createTestApp()
		const { project, sk, en, cookie } = await setup(app)
		const key = await createKey(project.id, 'Uložiť', { values: { [sk.id]: 'Uložiť', [en.id]: 'Save' } })

		expect(await patchOk(app, cookie, project.id, key.id, { name: '  actions.save ' })).toEqual({
			keyId: key.id,
			namespace: 'loc',
			name: 'actions.save',
			group: 'loc:actions',
			description: null,
			plural: null,
		})
		const body = await list(app, cookie, project.id, sk.id, en.id)
		expect(body.items).toMatchObject([{ keyId: key.id, name: 'actions.save', group: 'loc:actions', description: null, plural: null }])
		expect(await values(key.id)).toEqual({ [sk.id]: 'Uložiť', [en.id]: 'Save' })
	})

	it('returns 409 TRANSLATION_KEY_TAKEN for a name used in the same namespace and renames across namespaces', async () => {
		const app = createTestApp()
		const { project, cookie } = await setup(app)
		const key = await createKey(project.id, 'a')
		await createKey(project.id, 'b')
		await createKey(project.id, 'c', { namespace: 'paths' })

		expectErrorCode(await patch(app, cookie, project.id, key.id, { name: 'b' }), 409, ERROR_CODE.TRANSLATION_KEY_TAKEN)
		expect((await findKey(key.id)).name).toBe('a')
		expect(await patchOk(app, cookie, project.id, key.id, { name: 'c' })).toMatchObject({ name: 'c', namespace: 'loc' })
		expect(await patchOk(app, cookie, project.id, key.id, { name: 'c' })).toMatchObject({ name: 'c' })
	})

	it('sets and clears the description', async () => {
		const app = createTestApp()
		const { project, sk, en, cookie } = await setup(app)
		const key = await createKey(project.id, 'a')

		expect(await patchOk(app, cookie, project.id, key.id, { description: ' Button in the order header ' })).toMatchObject({
			description: 'Button in the order header',
		})
		expect((await findKey(key.id)).description).toBe('Button in the order header')
		expect((await list(app, cookie, project.id, sk.id, en.id)).items[0]?.description).toBe('Button in the order header')
		expect(await patchOk(app, cookie, project.id, key.id, { description: null })).toMatchObject({ description: null, name: 'a' })
		expect((await findKey(key.id)).description).toBeNull()
	})

	it('turns plural on: wraps every non-null value as the other form, null stays null, converted rows get updatedById', async () => {
		const app = createTestApp()
		const { user, project, sk, en, cookie } = await setup(app)
		const key = await createKey(project.id, 'items', { values: { [sk.id]: '{{count}} položiek', [en.id]: null } })

		expect(await patchOk(app, cookie, project.id, key.id, { plural: {} })).toMatchObject({ plural: { variable: 'count' } })
		expect(await values(key.id)).toEqual({ [sk.id]: '{count, plural, other {{{count}} položiek}}', [en.id]: null })
		expect(await updatedBy(key.id)).toEqual({ [sk.id]: user.id, [en.id]: null })
		expect((await findKey(key.id)).pluralVariable).toBe('count')
		expect((await list(app, cookie, project.id, sk.id, en.id)).items[0]?.plural).toEqual({ variable: 'count' })
	})

	it('turns plural on: a value that already is a plural message keeps its forms under the new variable', async () => {
		const app = createTestApp()
		const { project, sk, cookie } = await setup(app)
		const key = await createKey(project.id, 'items', { values: { [sk.id]: '{n, plural, one {# položka} other {# položiek}}' } })

		await patchOk(app, cookie, project.id, key.id, { plural: { variable: 'count' } })
		expect(await values(key.id)).toEqual({ [sk.id]: '{count, plural, one {# položka} other {# položiek}}' })
	})

	it('turns plural off: keeps the other form, leaves an unparseable value as is', async () => {
		const app = createTestApp()
		const { project, sk, en, cookie } = await setup(app)
		const key = await createKey(project.id, 'items', {
			pluralVariable: 'count',
			values: { [sk.id]: '{count, plural, one {# položka} few {# položky} other {# položiek}}', [en.id]: 'plain text' },
		})

		expect(await patchOk(app, cookie, project.id, key.id, { plural: null })).toMatchObject({ plural: null })
		expect(await values(key.id)).toEqual({ [sk.id]: '# položiek', [en.id]: 'plain text' })
		expect((await findKey(key.id)).pluralVariable).toBeNull()
	})

	it('renames the plural variable: re-serializes parseable values with updatedById, leaves others untouched', async () => {
		const app = createTestApp()
		const { user, project, sk, en, cookie } = await setup(app)
		const key = await createKey(project.id, 'items', {
			pluralVariable: 'count',
			values: { [sk.id]: '{count, plural, one {# položka} other {# položiek}}', [en.id]: 'not a plural' },
		})

		expect(await patchOk(app, cookie, project.id, key.id, { plural: { variable: 'n' } })).toMatchObject({ plural: { variable: 'n' } })
		expect(await values(key.id)).toEqual({ [sk.id]: '{n, plural, one {# položka} other {# položiek}}', [en.id]: 'not a plural' })
		expect(await updatedBy(key.id)).toEqual({ [sk.id]: user.id, [en.id]: null })
	})

	it('leaves values alone when the plural setting does not change', async () => {
		const app = createTestApp()
		const { project, sk, cookie } = await setup(app)
		const key = await createKey(project.id, 'items', { pluralVariable: 'count', values: { [sk.id]: '{count, plural, other {x}}' } })

		await patchOk(app, cookie, project.id, key.id, { plural: { variable: 'count' }, name: 'items2' })
		expect(await values(key.id)).toEqual({ [sk.id]: '{count, plural, other {x}}' })
	})

	it('returns 400 VALIDATION_ERROR for an empty body, a too long name or description and a bad variable', async () => {
		const app = createTestApp()
		const { project, cookie } = await setup(app)
		const key = await createKey(project.id, 'a')

		expectErrorCode(await patch(app, cookie, project.id, key.id, {}), 400, ERROR_CODE.VALIDATION_ERROR)
		expectErrorCode(await patch(app, cookie, project.id, key.id, { name: 'č'.repeat(1001) }), 400, ERROR_CODE.VALIDATION_ERROR)
		expectErrorCode(await patch(app, cookie, project.id, key.id, { name: ' ' }), 400, ERROR_CODE.VALIDATION_ERROR)
		expectErrorCode(await patch(app, cookie, project.id, key.id, { description: 'x'.repeat(501) }), 400, ERROR_CODE.VALIDATION_ERROR)
		expectErrorCode(await patch(app, cookie, project.id, key.id, { plural: { variable: '1x' } }), 400, ERROR_CODE.VALIDATION_ERROR)
		expect(await findKey(key.id)).toMatchObject({ name: 'a', description: null, pluralVariable: null })
	})

	it.each([
		{ name: 'a key id that is not a uuid', keyId: 'not-a-uuid' },
		{ name: 'an unknown key', keyId: randomUUID() },
		{ name: 'a key of another project', keyId: 'foreign' },
	])('returns 404 TRANSLATION_KEY_NOT_FOUND for $name', async ({ keyId }) => {
		const app = createTestApp()
		const { project, cookie } = await setup(app)
		const other = await createProject()
		const foreignKey = await createKey(other.id, 'a')

		expectErrorCode(
			await patch(app, cookie, project.id, keyId === 'foreign' ? foreignKey.id : keyId, { name: 'b' }),
			404,
			ERROR_CODE.TRANSLATION_KEY_NOT_FOUND,
		)
		expect((await findKey(foreignKey.id)).name).toBe('a')
	})

	it('returns 403 FORBIDDEN to a member, 404 NOT_FOUND to a non-member EDITOR and 200 to an ADMIN who is not a member', async () => {
		const app = createTestApp()
		const member = await setup(app, { role: ROLE.EDITOR })
		const outsider = await setup(app, { role: ROLE.EDITOR, member: false })
		const admin = await setup(app, { role: ROLE.ADMIN, member: false })
		const memberKey = await createKey(member.project.id, 'a')
		const outsiderKey = await createKey(outsider.project.id, 'a')
		const adminKey = await createKey(admin.project.id, 'a')

		expectErrorCode(await patch(app, member.cookie, member.project.id, memberKey.id, { name: 'b' }), 403, ERROR_CODE.FORBIDDEN)
		expectErrorCode(await patch(app, outsider.cookie, outsider.project.id, outsiderKey.id, { name: 'b' }), 404, ERROR_CODE.NOT_FOUND)
		expect(await patchOk(app, admin.cookie, admin.project.id, adminKey.id, { name: 'b' })).toMatchObject({ name: 'b' })
		expect((await findKey(memberKey.id)).name).toBe('a')
	})

	it('returns 401 AUTH_UNAUTHENTICATED without a session and 403 CSRF_REJECTED without X-Requested-With', async () => {
		const app = createTestApp()
		const { project, cookie } = await setup(app)
		const key = await createKey(project.id, 'a')
		const url = `/api/projects/${project.id}/keys/${key.id}`

		expectErrorCode(await request(app).patch(url).set(CSRF_HEADERS).send({ name: 'b' }), 401, ERROR_CODE.AUTH_UNAUTHENTICATED)
		expectErrorCode(await request(app).patch(url).set('Cookie', cookie).send({ name: 'b' }), 403, ERROR_CODE.CSRF_REJECTED)
		expect((await findKey(key.id)).name).toBe('a')
	})
})
