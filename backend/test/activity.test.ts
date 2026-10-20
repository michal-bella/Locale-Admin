import { randomUUID } from 'node:crypto'

import request from 'supertest'
import { describe, expect, it } from 'vitest'

import { ACTIVITY_TYPE, ROLE, activityEventDataSchema } from '@locale/shared'

import { createTestApp } from './helpers/app'
import { CSRF_HEADERS, loginAs } from './helpers/auth'
import { getTestPrisma } from './helpers/db'
import { TEST_PASSWORD, createUser } from './helpers/users'

type App = ReturnType<typeof createTestApp>

type Method = 'post' | 'put' | 'patch' | 'delete'

const send = async (app: App, cookie: string, method: Method, path: string, body: object, status: number) => {
	const res = await request(app)[method](`/api${path}`).set('Cookie', cookie).set(CSRF_HEADERS).send(body)
	expect(res.status, JSON.stringify(res.body)).toBe(status)
	return res
}

/** Every event of the project, oldest first, with the payload checked against the shared schema. */
const events = async (projectId: string) => {
	const rows = await getTestPrisma().activityEvent.findMany({ where: { projectId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] })
	return rows.map(({ type, payload, userId, count }) => ({ ...activityEventDataSchema.parse({ type, payload }), userId, count }))
}

const login = async (app: App, role: ROLE, names: { firstName?: string; lastName?: string } = {}) => {
	const { user } = await createUser({ role, ...names })
	return { user, cookie: await loginAs(app, { email: user.email, password: TEST_PASSWORD }) }
}

/** A project with `sk` (base) and `en` whose member is a new logged-in user (ADMIN unless given). */
const setup = async (app: App, role: ROLE = ROLE.ADMIN) => {
	const { user, cookie } = await login(app, role, { firstName: 'Martin', lastName: 'Kováč' })
	const prisma = getTestPrisma()
	const project = await prisma.project.create({
		data: { name: 'A', slug: `a-${randomUUID().slice(0, 8)}`, members: { create: { userId: user.id } } },
	})
	const sk = await prisma.projectLanguage.create({ data: { projectId: project.id, tag: 'sk', isBase: true, position: 0 } })
	const en = await prisma.projectLanguage.create({ data: { projectId: project.id, tag: 'en', position: 1 } })
	return { user, cookie, project, sk, en }
}

const createKey = (projectId: string, name: string, values: Record<string, string | null> = {}) =>
	getTestPrisma().translationKey.create({
		data: { projectId, namespace: 'loc', name, translations: { create: Object.entries(values).map(([languageId, value]) => ({ languageId, value })) } },
	})

describe('activity events', () => {
	it('records the project creation and nothing for a taken slug', async () => {
		const app = createTestApp()
		const { user, cookie } = await login(app, ROLE.EDITOR)

		const res = await send(app, cookie, 'post', '/projects', { name: 'Web', slug: 'web', languageTags: ['sk', 'en'] }, 201)
		await send(app, cookie, 'post', '/projects', { name: 'Iný', slug: 'web', languageTags: ['sk'] }, 409)

		expect(await events((res.body as { id: string }).id)).toEqual([
			{ type: ACTIVITY_TYPE.PROJECT_CREATED, payload: { name: 'Web' }, userId: user.id, count: 1 },
		])
		await expect(getTestPrisma().activityEvent.count()).resolves.toBe(1)
	})

	it('records only the settings that changed, the base language move, and nothing when the update fails', async () => {
		const app = createTestApp()
		const { user, cookie, project, en } = await setup(app)
		const settings = { name: 'A', slug: project.slug, primaryColor: '#E83E8C', protectVariables: true }
		await getTestPrisma().project.create({ data: { name: 'B', slug: 'taken' } })
		const path = `/projects/${project.id}/settings`

		await send(app, cookie, 'patch', path, settings, 200)
		await send(app, cookie, 'patch', path, { ...settings, name: 'Web', primaryColor: '#00aa00' }, 200)
		await send(app, cookie, 'patch', path, { ...settings, name: 'Web', primaryColor: '#00AA00', baseLanguageId: en.id }, 200)
		await send(
			app,
			cookie,
			'patch',
			path,
			{ ...settings, slug: 'taken', baseLanguageId: (await getTestPrisma().projectLanguage.findFirstOrThrow({ where: { tag: 'sk' } })).id },
			409,
		)

		expect(await events(project.id)).toEqual([
			{ type: ACTIVITY_TYPE.PROJECT_UPDATED, payload: { fields: ['name', 'primaryColor'] }, userId: user.id, count: 1 },
			{ type: ACTIVITY_TYPE.BASE_LANGUAGE_CHANGED, payload: { fromTag: 'sk', toTag: 'en' }, userId: user.id, count: 1 },
		])
	})

	it('records added and removed languages, a base change by reordering, and nothing for refused changes', async () => {
		const app = createTestApp()
		const { user, cookie, project, sk, en } = await setup(app)
		const path = `/projects/${project.id}/languages`

		const cs = (await send(app, cookie, 'post', path, { tag: 'cs' }, 201)).body as { id: string }
		await send(app, cookie, 'post', path, { tag: 'cs' }, 409)
		await send(app, cookie, 'put', `${path}/order`, { languageIds: [sk.id, cs.id, en.id] }, 200)
		await send(app, cookie, 'put', `${path}/order`, { languageIds: [en.id, sk.id, cs.id] }, 200)
		await send(app, cookie, 'delete', `${path}/${en.id}`, {}, 409)
		await send(app, cookie, 'delete', `${path}/${cs.id}`, {}, 204)

		expect(await events(project.id)).toEqual([
			{ type: ACTIVITY_TYPE.LANGUAGE_ADDED, payload: { tag: 'cs' }, userId: user.id, count: 1 },
			{ type: ACTIVITY_TYPE.BASE_LANGUAGE_CHANGED, payload: { fromTag: 'sk', toTag: 'en' }, userId: user.id, count: 1 },
			{ type: ACTIVITY_TYPE.LANGUAGE_REMOVED, payload: { tag: 'cs' }, userId: user.id, count: 1 },
		])
	})

	it('records added, removed and leaving members with a snapshot of the user', async () => {
		const app = createTestApp()
		const { user: admin, cookie, project } = await setup(app)
		const { user: jana, cookie: janaCookie } = await login(app, ROLE.EDITOR, { firstName: 'Jana' })
		const { user: peter } = await createUser({ email: 'peter@example.com' })
		const path = `/projects/${project.id}/members`

		await send(app, cookie, 'post', path, { userId: jana.id }, 201)
		await send(app, cookie, 'post', path, { userId: jana.id }, 409)
		await send(app, cookie, 'post', path, { userId: peter.id }, 201)
		await send(app, cookie, 'delete', `${path}/${peter.id}`, {}, 204)
		await send(app, janaCookie, 'delete', `/projects/${project.id}/membership`, {}, 204)
		await send(app, cookie, 'delete', `/projects/${project.id}/membership`, {}, 409)

		const snapshot = (user: typeof jana) => ({ id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email })
		expect(await events(project.id)).toEqual([
			{ type: ACTIVITY_TYPE.MEMBER_ADDED, payload: { member: snapshot(jana) }, userId: admin.id, count: 1 },
			{ type: ACTIVITY_TYPE.MEMBER_ADDED, payload: { member: snapshot(peter) }, userId: admin.id, count: 1 },
			{ type: ACTIVITY_TYPE.MEMBER_REMOVED, payload: { member: snapshot(peter), left: false }, userId: admin.id, count: 1 },
			{ type: ACTIVITY_TYPE.MEMBER_REMOVED, payload: { member: snapshot(jana), left: true }, userId: jana.id, count: 1 },
		])
	})

	it('records a translation only when its stored value changes', async () => {
		const app = createTestApp()
		const { user, cookie, project, sk, en } = await setup(app, ROLE.EDITOR)
		const key = await createKey(project.id, 'Počet: {{count}}', { [sk.id]: 'Počet: {{count}}' })
		const path = `/projects/${project.id}/keys/${key.id}/translations/${en.id}`

		await send(app, cookie, 'put', path, { value: null }, 200)
		await send(app, cookie, 'put', path, { value: 'Count: {{count}}' }, 200)
		await send(app, cookie, 'put', path, { value: 'Count: {{count}}' }, 200)
		await send(app, cookie, 'put', path, { value: 'Count' }, 400)
		await send(app, cookie, 'put', path, { value: 'Total: {{count}}' }, 200)
		await send(app, cookie, 'put', path, { value: '' }, 200)

		const payload = { keyId: key.id, namespace: 'loc', name: 'Počet: {{count}}', languageTag: 'en' }
		expect(await events(project.id)).toEqual([
			{ type: ACTIVITY_TYPE.TRANSLATION_UPDATED, payload: { ...payload, oldValue: null, newValue: 'Count: {{count}}' }, userId: user.id, count: 1 },
			{
				type: ACTIVITY_TYPE.TRANSLATION_UPDATED,
				payload: { ...payload, oldValue: 'Count: {{count}}', newValue: 'Total: {{count}}' },
				userId: user.id,
				count: 1,
			},
			{ type: ACTIVITY_TYPE.TRANSLATION_UPDATED, payload: { ...payload, oldValue: 'Total: {{count}}', newValue: null }, userId: user.id, count: 1 },
		])
	})

	it('records only the key attributes that changed and nothing for a taken name', async () => {
		const app = createTestApp()
		const { user, cookie, project } = await setup(app)
		const key = await createKey(project.id, 'a')
		await createKey(project.id, 'taken')
		const path = `/projects/${project.id}/keys/${key.id}`

		await send(app, cookie, 'patch', path, { description: 'Tlačidlo' }, 200)
		await send(app, cookie, 'patch', path, { name: 'a', description: 'Tlačidlo' }, 200)
		await send(app, cookie, 'patch', path, { name: 'taken' }, 409)
		await send(app, cookie, 'patch', path, { name: 'b', plural: { variable: 'count' } }, 200)

		const payload = { keyId: key.id, namespace: 'loc' }
		expect(await events(project.id)).toEqual([
			{ type: ACTIVITY_TYPE.KEY_UPDATED, payload: { ...payload, name: 'a', fields: ['description'] }, userId: user.id, count: 1 },
			{ type: ACTIVITY_TYPE.KEY_UPDATED, payload: { ...payload, name: 'b', fields: ['name', 'pluralVariable'] }, userId: user.id, count: 1 },
		])
	})

	it('records one event per import counting the written values, and nothing for an import without changes', async () => {
		const app = createTestApp()
		const { user, cookie, project, sk, en } = await setup(app)
		await createKey(project.id, 'Uložiť', { [sk.id]: 'Uložiť', [en.id]: 'Store' })
		const body = {
			fileName: 'translations.csv',
			content: ['Keys; sk ; en', '--loc--', ' Uložiť; Uložiť; Save', ' Zrušiť; Zrušiť; null', ' Späť; null; null'].join('\n'),
			columns: [
				{ columnIndex: 2, languageId: sk.id },
				{ columnIndex: 3, languageId: en.id },
			],
		}

		await send(app, cookie, 'post', `/projects/${project.id}/imports`, body, 200)
		await send(app, cookie, 'post', `/projects/${project.id}/imports`, body, 200)

		expect(await events(project.id)).toEqual([
			{
				type: ACTIVITY_TYPE.KEYS_IMPORTED,
				payload: { keysCreated: 2, translationsCreated: 1, translationsUpdated: 1, languageTags: ['sk', 'en'] },
				userId: user.id,
				count: 2,
			},
		])
	})

	it('keeps the events of a deleted user without the user', async () => {
		const app = createTestApp()
		const { user, cookie, project, en } = await setup(app, ROLE.EDITOR)
		const key = await createKey(project.id, 'Uložiť')

		await send(app, cookie, 'put', `/projects/${project.id}/keys/${key.id}/translations/${en.id}`, { value: 'Save' }, 200)
		await getTestPrisma().user.delete({ where: { id: user.id } })

		expect(await events(project.id)).toMatchObject([{ type: ACTIVITY_TYPE.TRANSLATION_UPDATED, userId: null }])
	})
})
