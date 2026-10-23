import { randomUUID } from 'node:crypto'

import request from 'supertest'
import { describe, expect, it } from 'vitest'

import { ERROR_CODE, ROLE, errorResponseSchema, translationsResponseSchema, updateTranslationResponseSchema } from '@locale/shared'

import { createTestApp } from './helpers/app'
import { CSRF_HEADERS, loginAs } from './helpers/auth'
import { getTestPrisma } from './helpers/db'
import { TEST_PASSWORD, createUser } from './helpers/users'
import { createVersionRow, versionIdOf } from './helpers/versions'

type App = ReturnType<typeof createTestApp>

const expectErrorCode = (res: request.Response, status: number, code: ERROR_CODE) => {
	expect(res.status).toBe(status)
	expect(errorResponseSchema.parse(res.body).error.code).toBe(code)
}

const createProject = (members: string[] = [], protectVariables = true) =>
	getTestPrisma().project.create({
		data: { name: 'A', slug: `a-${randomUUID().slice(0, 8)}`, protectVariables, members: { create: members.map((userId) => ({ userId })) } },
	})

const createLanguage = (projectId: string, tag: string, isBase = false) => getTestPrisma().projectLanguage.create({ data: { projectId, tag, isBase } })

/** `values` maps a language id to its value; a language left out has no row. */
const createKey = async (projectId: string, name: string, values: Record<string, string | null> = {}, pluralVariable: string | null = null) =>
	getTestPrisma().translationKey.create({
		data: {
			projectId,
			versionId: await versionIdOf(projectId),
			namespace: 'loc',
			name,
			pluralVariable,
			translations: { create: Object.entries(values).map(([languageId, value]) => ({ languageId, value })) },
		},
	})

/** Logs in a new user who is a member of a new project with `sk` (base) and `en`. */
const setup = async (app: App, { role = ROLE.EDITOR, member = true, protectVariables = true } = {}) => {
	const { user } = await createUser({ role })
	const project = await createProject(member ? [user.id] : [], protectVariables)
	await createVersionRow(project.id)
	const sk = await createLanguage(project.id, 'sk', true)
	const en = await createLanguage(project.id, 'en')
	return { user, project, sk, en, cookie: await loginAs(app, { email: user.email, password: TEST_PASSWORD }) }
}

const put = (app: App, cookie: string, projectId: string, keyId: string, languageId: string, value: string | null) =>
	request(app).put(`/api/projects/${projectId}/keys/${keyId}/translations/${languageId}`).set('Cookie', cookie).set(CSRF_HEADERS).send({ value })

const putOk = async (...args: Parameters<typeof put>) => {
	const res = await put(...args)
	expect(res.status).toBe(200)
	return updateTranslationResponseSchema.strict().parse(res.body)
}

const findRow = (keyId: string, languageId: string) => getTestPrisma().translation.findUnique({ where: { keyId_languageId: { keyId, languageId } } })

const placeholderDetails = (res: request.Response) => errorResponseSchema.parse(res.body).error.details

describe('PUT /api/projects/:projectId/keys/:keyId/translations/:languageId', () => {
	it('returns the editor as the full name, the e-mail without a name, and lists null once the user is deleted', async () => {
		const app = createTestApp()
		const { user, project, sk, en, cookie } = await setup(app)
		const prisma = getTestPrisma()
		const key = await createKey(project.id, 'Uložiť', { [sk.id]: 'Uložiť' })

		await prisma.user.update({ where: { id: user.id }, data: { firstName: 'Martin', lastName: 'Kováč' } })
		expect((await putOk(app, cookie, project.id, key.id, en.id, 'Save')).updatedBy).toEqual({ id: user.id, name: 'Martin Kováč' })

		await prisma.user.update({ where: { id: user.id }, data: { firstName: null, lastName: null } })
		expect((await putOk(app, cookie, project.id, key.id, en.id, 'Store')).updatedBy).toEqual({ id: user.id, name: user.email })

		const { user: admin } = await createUser({ role: ROLE.ADMIN })
		const adminCookie = await loginAs(app, { email: admin.email, password: TEST_PASSWORD })
		await prisma.user.delete({ where: { id: user.id } })
		const res = await request(app)
			.get(`/api/projects/${project.id}/translations`)
			.query({ versionId: await versionIdOf(project.id) })
			.set('Cookie', adminCookie)
		expect(translationsResponseSchema.parse(res.body).items[0]?.translations[en.id]).toMatchObject({ value: 'Store', updatedBy: null })
	})

	it('creates, updates and clears the target row with updatedById and updatedAt', async () => {
		const app = createTestApp()
		const { user, project, sk, en, cookie } = await setup(app)
		const key = await createKey(project.id, 'Uložiť', { [sk.id]: 'Uložiť' })
		const before = new Date()

		const created = await putOk(app, cookie, project.id, key.id, en.id, 'Save')
		expect(created).toMatchObject({ value: 'Save', status: 'TRANSLATED' })
		expect(new Date(created.updatedAt).getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000)
		expect(await findRow(key.id, en.id)).toMatchObject({ value: 'Save', updatedById: user.id, updatedAt: new Date(created.updatedAt) })

		const updated = await putOk(app, cookie, project.id, key.id, en.id, 'Store')
		expect(updated).toMatchObject({ value: 'Store', status: 'TRANSLATED' })
		expect(new Date(updated.updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(created.updatedAt).getTime())
		expect(await findRow(key.id, en.id)).toMatchObject({ value: 'Store', updatedById: user.id })

		const cleared = await putOk(app, cookie, project.id, key.id, en.id, null)
		expect(cleared).toMatchObject({ value: null, status: 'UNTRANSLATED' })
		expect(await findRow(key.id, en.id)).toMatchObject({ value: null, updatedById: user.id })
	})

	it('stores an empty or whitespace-only value as null, also when no row exists yet', async () => {
		const app = createTestApp()
		const { project, sk, en, cookie } = await setup(app)
		const key = await createKey(project.id, 'Uložiť', { [sk.id]: 'Uložiť' })

		expect(await putOk(app, cookie, project.id, key.id, en.id, '')).toMatchObject({ value: null, status: 'UNTRANSLATED' })
		expect(await findRow(key.id, en.id)).toMatchObject({ value: null })
		expect(await putOk(app, cookie, project.id, key.id, en.id, '  \n ')).toMatchObject({ value: null, status: 'UNTRANSLATED' })
	})

	it('returns 400 PLACEHOLDER_MISMATCH with normalized missing and extra placeholders and writes nothing', async () => {
		const app = createTestApp()
		const { project, sk, en, cookie } = await setup(app)
		const key = await createKey(project.id, 'items', { [sk.id]: 'Máte {{ count }} položiek od {{- name}} za {{price, currency}}', [en.id]: 'old' })

		const res = await put(app, cookie, project.id, key.id, en.id, 'You have {{count}} items for {{ total }}')

		expectErrorCode(res, 400, ERROR_CODE.PLACEHOLDER_MISMATCH)
		expect(placeholderDetails(res)).toEqual({ missing: ['{{name}}', '{{price}}'], extra: ['{{total}}'] })
		expect(await findRow(key.id, en.id)).toMatchObject({ value: 'old' })
	})

	it('returns 400 PLACEHOLDER_MISMATCH when a placeholder is repeated more often than in the base language', async () => {
		const app = createTestApp()
		const { project, sk, en, cookie } = await setup(app)
		const key = await createKey(project.id, 'requests', { [sk.id]: 'Zobraziť ďalšie žiadosti ({{remaining}})' })

		const res = await put(app, cookie, project.id, key.id, en.id, 'Show more ({{remaining}}) of ({{remaining}})')

		expectErrorCode(res, 400, ERROR_CODE.PLACEHOLDER_MISMATCH)
		expect(placeholderDetails(res)).toEqual({ missing: [], extra: ['{{remaining}}'] })
		expect(await findRow(key.id, en.id)).toBeNull()
	})

	it('treats {{ count }}, {{- count}} and {{count, number}} as the same placeholder', async () => {
		const app = createTestApp()
		const { project, sk, en, cookie } = await setup(app)
		const key = await createKey(project.id, 'items', { [sk.id]: 'Máte {{ count }} položiek' })

		for (const value of ['You have {{count}} items', 'You have {{- count}} items', 'You have {{count, number}} items', '{{ count }}']) {
			expect(await putOk(app, cookie, project.id, key.id, en.id, value)).toMatchObject({ value, status: 'TRANSLATED' })
		}
		const res = await put(app, cookie, project.id, key.id, en.id, 'You have items')
		expectErrorCode(res, 400, ERROR_CODE.PLACEHOLDER_MISMATCH)
		expect(placeholderDetails(res)).toEqual({ missing: ['{{count}}'], extra: [] })
	})

	it('never blocks editing the base language of a path key and skips the check when the base value is null or missing', async () => {
		const app = createTestApp()
		const { project, sk, en, cookie } = await setup(app)
		const withBase = await createKey(project.id, 'a', { [sk.id]: 'Máte {{count}} položiek', [en.id]: 'You have {{count}} items' })
		const nullBase = await createKey(project.id, 'b', { [sk.id]: null })
		const noBase = await createKey(project.id, 'c')

		expect(await putOk(app, cookie, project.id, withBase.id, sk.id, 'Máte {{total}} položiek')).toMatchObject({ value: 'Máte {{total}} položiek' })
		expect(await putOk(app, cookie, project.id, nullBase.id, en.id, '{{anything}}')).toMatchObject({ status: 'TRANSLATED' })
		expect(await putOk(app, cookie, project.id, noBase.id, en.id, '{{anything}}')).toMatchObject({ status: 'TRANSLATED' })
	})

	it('checks the base language of a sentence key against the placeholders of the key name', async () => {
		const app = createTestApp()
		const { project, sk, cookie } = await setup(app)
		const key = await createKey(project.id, 'Cena do vrátane DPH ({{symbol}})', { [sk.id]: 'Cena do vrátane DPH ({{symbol}})' })

		const res = await put(app, cookie, project.id, key.id, sk.id, 'Cena ({{symbol}}) Cena ({{symbol}})')

		expectErrorCode(res, 400, ERROR_CODE.PLACEHOLDER_MISMATCH)
		expect(placeholderDetails(res)).toEqual({ missing: [], extra: ['{{symbol}}'] })
		expect(await findRow(key.id, sk.id)).toMatchObject({ value: 'Cena do vrátane DPH ({{symbol}})' })
		expect(await putOk(app, cookie, project.id, key.id, sk.id, 'Cena vrátane DPH ({{ symbol }})')).toMatchObject({ status: 'TRANSLATED' })
	})

	it('checks the other languages of a sentence key against the key name, not a base value that dropped a variable', async () => {
		const app = createTestApp()
		const { project, sk, en, cookie } = await setup(app)
		const key = await createKey(project.id, 'Na udalosť je prihlásených {{count}} ľudí.', { [sk.id]: 'Klientom bude odoslaná notifikácia.' })

		expect(await putOk(app, cookie, project.id, key.id, en.id, '{{count}} clients are already booked.')).toMatchObject({ status: 'TRANSLATED' })
		const res = await put(app, cookie, project.id, key.id, en.id, 'Clients will be notified.')
		expectErrorCode(res, 400, ERROR_CODE.PLACEHOLDER_MISMATCH)
		expect(placeholderDetails(res)).toEqual({ missing: ['{{count}}'], extra: [] })
	})

	it('takes the placeholders from the key name when the base value is null or missing', async () => {
		const app = createTestApp()
		const { project, sk, en, cookie } = await setup(app)
		const nullBase = await createKey(project.id, 'Cena do vrátane DPH ({{symbol}})', { [sk.id]: null })
		const noBase = await createKey(project.id, 'Spolu {{count}} položiek')

		const res = await put(app, cookie, project.id, nullBase.id, en.id, 'Price incl. VAT')
		expectErrorCode(res, 400, ERROR_CODE.PLACEHOLDER_MISMATCH)
		expect(placeholderDetails(res)).toEqual({ missing: ['{{symbol}}'], extra: [] })
		expect(await findRow(nullBase.id, en.id)).toBeNull()
		expect(await putOk(app, cookie, project.id, nullBase.id, en.id, 'Price incl. VAT ({{symbol}})')).toMatchObject({ status: 'TRANSLATED' })
		expectErrorCode(await put(app, cookie, project.id, noBase.id, en.id, '{{total}} items'), 400, ERROR_CODE.PLACEHOLDER_MISMATCH)
	})

	it('allows a mismatch when protectVariables is off', async () => {
		const app = createTestApp()
		const { project, sk, en, cookie } = await setup(app, { protectVariables: false })
		const key = await createKey(project.id, 'items', { [sk.id]: 'Máte {{count}} položiek' })

		expect(await putOk(app, cookie, project.id, key.id, en.id, 'You have items')).toMatchObject({ value: 'You have items', status: 'TRANSLATED' })
	})

	it('is reflected in the list with the new value and status', async () => {
		const app = createTestApp()
		const { project, sk, en, cookie } = await setup(app)
		const key = await createKey(project.id, 'Uložiť', { [sk.id]: 'Uložiť' })

		const saved = await putOk(app, cookie, project.id, key.id, en.id, 'Save')
		const res = await request(app)
			.get(`/api/projects/${project.id}/translations`)
			.query({ versionId: await versionIdOf(project.id), sourceLanguageId: sk.id, targetLanguageId: en.id })
			.set('Cookie', cookie)

		expect(res.status).toBe(200)
		const body = translationsResponseSchema.parse(res.body)
		expect(body.items[0]?.translations[en.id]).toEqual({ value: 'Save', status: 'TRANSLATED', updatedAt: saved.updatedAt, updatedBy: saved.updatedBy })
		expect(body.stats).toEqual({ totalKeys: 1, translated: 1, untranslated: 0, warnings: 0, untranslatedByLanguage: expect.any(Object) as unknown })
	})

	it('returns 400 VALIDATION_ERROR for a missing or too long value', async () => {
		const app = createTestApp()
		const { project, sk, en, cookie } = await setup(app)
		const key = await createKey(project.id, 'Uložiť', { [sk.id]: 'Uložiť' })
		const url = `/api/projects/${project.id}/keys/${key.id}/translations/${en.id}`

		expectErrorCode(await request(app).put(url).set('Cookie', cookie).set(CSRF_HEADERS).send({}), 400, ERROR_CODE.VALIDATION_ERROR)
		expectErrorCode(await put(app, cookie, project.id, key.id, en.id, 'x'.repeat(10_001)), 400, ERROR_CODE.VALIDATION_ERROR)
		expect(await findRow(key.id, en.id)).toBeNull()
	})

	it('on a plural key accepts only a plural message with the key variable and writes nothing otherwise', async () => {
		const app = createTestApp()
		const { project, sk, en, cookie } = await setup(app)
		const key = await createKey(project.id, 'items', { [sk.id]: '{count, plural, other {{{count}} položiek}}' }, 'count')

		for (const value of ['{count, plural, one {# item}} other {# items}}', 'plain text', '{n, plural, other {# items}}']) {
			const res = await put(app, cookie, project.id, key.id, en.id, value)
			expectErrorCode(res, 400, ERROR_CODE.VALIDATION_ERROR)
			expect(errorResponseSchema.parse(res.body).error.details).toEqual([{ path: 'value', code: 'INVALID' }])
		}
		expect(await findRow(key.id, en.id)).toBeNull()

		const value = '{count, plural,\n\tone {# item}\n\tother {{{count}} items}\n}'
		expect(await putOk(app, cookie, project.id, key.id, en.id, value)).toMatchObject({ value, status: 'TRANSLATED' })
		expect(await putOk(app, cookie, project.id, key.id, en.id, null)).toMatchObject({ value: null, status: 'UNTRANSLATED' })
	})

	it.each([
		{ name: 'a key id that is not a uuid', keyId: 'not-a-uuid', code: ERROR_CODE.TRANSLATION_KEY_NOT_FOUND },
		{ name: 'an unknown key', keyId: randomUUID(), code: ERROR_CODE.TRANSLATION_KEY_NOT_FOUND },
		{ name: 'a key of another project', keyId: 'foreign', code: ERROR_CODE.TRANSLATION_KEY_NOT_FOUND },
		{ name: 'a language id that is not a uuid', languageId: 'not-a-uuid', code: ERROR_CODE.NOT_FOUND },
		{ name: 'a language of another project', languageId: 'foreign', code: ERROR_CODE.NOT_FOUND },
	])('returns 404 $code for $name', async ({ keyId, languageId, code }) => {
		const app = createTestApp()
		const { project, sk, en, cookie } = await setup(app)
		const key = await createKey(project.id, 'Uložiť', { [sk.id]: 'Uložiť' })
		const other = await createProject()
		const foreignLanguage = await createLanguage(other.id, 'sk', true)
		const foreignKey = await createKey(other.id, 'Uložiť', { [foreignLanguage.id]: 'Uložiť' })
		const resolvedKeyId = keyId === 'foreign' ? foreignKey.id : (keyId ?? key.id)
		const resolvedLanguageId = languageId === 'foreign' ? foreignLanguage.id : (languageId ?? en.id)

		expectErrorCode(await put(app, cookie, project.id, resolvedKeyId, resolvedLanguageId, 'Save'), 404, code)
		expect(await findRow(key.id, en.id)).toBeNull()
		expect(await findRow(foreignKey.id, foreignLanguage.id)).toMatchObject({ value: 'Uložiť' })
	})

	it('returns 404 NOT_FOUND to an EDITOR who is not a member and 200 to an ADMIN who is not', async () => {
		const app = createTestApp()
		const editor = await setup(app, { member: false })
		const admin = await setup(app, { role: ROLE.ADMIN, member: false })
		const editorKey = await createKey(editor.project.id, 'a')
		const adminKey = await createKey(admin.project.id, 'a')

		expectErrorCode(await put(app, editor.cookie, editor.project.id, editorKey.id, editor.en.id, 'A'), 404, ERROR_CODE.NOT_FOUND)
		expect(await putOk(app, admin.cookie, admin.project.id, adminKey.id, admin.en.id, 'A')).toMatchObject({ value: 'A' })
	})

	it('returns 403 FORBIDDEN to a VISITOR member and writes nothing', async () => {
		const app = createTestApp()
		const { project, sk, en, cookie } = await setup(app, { role: ROLE.VISITOR })
		const key = await createKey(project.id, 'a', { [sk.id]: 'A' })

		expectErrorCode(await put(app, cookie, project.id, key.id, en.id, 'B'), 403, ERROR_CODE.FORBIDDEN)
		expect(await findRow(key.id, en.id)).toBeNull()
		const list = await request(app)
			.get(`/api/projects/${project.id}/translations`)
			.query({ versionId: await versionIdOf(project.id) })
			.set('Cookie', cookie)
		expect(list.status).toBe(200)
		expect(translationsResponseSchema.parse(list.body).items.map(({ name }) => name)).toEqual(['a'])
	})

	it('returns 401 AUTH_UNAUTHENTICATED without a session and 403 CSRF_REJECTED without X-Requested-With', async () => {
		const app = createTestApp()
		const { project, en, cookie } = await setup(app)
		const key = await createKey(project.id, 'a')
		const url = `/api/projects/${project.id}/keys/${key.id}/translations/${en.id}`

		expectErrorCode(await request(app).put(url).set(CSRF_HEADERS).send({ value: 'A' }), 401, ERROR_CODE.AUTH_UNAUTHENTICATED)
		expectErrorCode(await request(app).put(url).set('Cookie', cookie).send({ value: 'A' }), 403, ERROR_CODE.CSRF_REJECTED)
		expect(await findRow(key.id, en.id)).toBeNull()
	})
})
