import { randomUUID } from 'node:crypto'

import request from 'supertest'
import { describe, expect, it } from 'vitest'

import {
	ERROR_CODE,
	ROLE,
	errorResponseSchema,
	translationGroup,
	translationListItemSchema,
	translationsResponseSchema,
	type TranslationsQueryInput,
} from '@locale/shared'

import { createTestApp } from './helpers/app'
import { loginAs } from './helpers/auth'
import { getTestPrisma } from './helpers/db'
import { TEST_PASSWORD, createUser } from './helpers/users'

type App = ReturnType<typeof createTestApp>

const expectErrorCode = (res: request.Response, status: number, code: ERROR_CODE) => {
	expect(res.status).toBe(status)
	expect(errorResponseSchema.parse(res.body).error.code).toBe(code)
}

const createProject = (members: string[] = []) =>
	getTestPrisma().project.create({
		data: { name: 'A', slug: `a-${randomUUID().slice(0, 8)}`, members: { create: members.map((userId) => ({ userId })) } },
	})

/** Logs in a new user who is a member of a new project with `sk` (base) and `en`. */
const setup = async (app: App, role: ROLE = ROLE.EDITOR, { member = true }: { member?: boolean } = {}) => {
	const { user } = await createUser({ role })
	const project = await createProject(member ? [user.id] : [])
	const sk = await createLanguage(project.id, 'sk', true)
	const en = await createLanguage(project.id, 'en')
	return { user, project, sk, en, cookie: await loginAs(app, { email: user.email, password: TEST_PASSWORD }) }
}

const createLanguage = (projectId: string, tag: string, isBase = false) => getTestPrisma().projectLanguage.create({ data: { projectId, tag, isBase } })

/** `values` maps a language id to its value; a language left out has no row. */
const createKey = (projectId: string, namespace: string, name: string, values: Record<string, string | null> = {}) =>
	getTestPrisma().translationKey.create({
		data: { projectId, namespace, name, translations: { create: Object.entries(values).map(([languageId, value]) => ({ languageId, value })) } },
	})

const list = (app: App, cookie: string, projectId: string, query: Partial<Record<keyof TranslationsQueryInput, string | number>>) =>
	request(app).get(`/api/projects/${projectId}/translations`).query(query).set('Cookie', cookie)

const listOk = async (...args: Parameters<typeof list>) => {
	const res = await list(...args)
	expect(res.status).toBe(200)
	return translationsResponseSchema.strict().parse(res.body)
}

const names = (body: { items: { name: string }[] }) => body.items.map(({ name }) => name)

const detailPaths = (res: request.Response) => {
	const details = errorResponseSchema.parse(res.body).error.details
	return Array.isArray(details) ? details.map(({ path }) => path) : details
}

describe('GET /api/projects/:projectId/translations', () => {
	it('returns keys with a cell per language, untranslated first, then by group and key, with stats and namespaces', async () => {
		const app = createTestApp()
		const { user, project, sk, en, cookie } = await setup(app)
		const other = await createProject()
		await createKey(other.id, 'foreign', 'Cudzí', { [(await createLanguage(other.id, 'sk', true)).id]: 'Cudzí' })
		const save = await createKey(project.id, 'loc', 'Uložiť', { [sk.id]: 'Uložiť', [en.id]: 'Save' })
		const missing = await createKey(project.id, 'loc', 'Zrušiť', { [sk.id]: 'Zrušiť' })
		const empty = await createKey(project.id, 'loc', 'orders.empty.title', { [sk.id]: 'Žiadne objednávky', [en.id]: null })
		const path = await createKey(project.id, 'paths', 'orders', { [en.id]: '/orders' })

		const body = await listOk(app, cookie, project.id, { sourceLanguageId: sk.id, targetLanguageId: en.id })

		const updatedAt = async (keyId: string, languageId: string) =>
			(await getTestPrisma().translation.findUniqueOrThrow({ where: { keyId_languageId: { keyId, languageId } } })).updatedAt.toISOString()
		const EMPTY = { value: null, status: 'UNTRANSLATED', updatedAt: null, updatedBy: null }
		expect(body).toEqual({
			items: [
				{
					keyId: missing.id,
					namespace: 'loc',
					name: 'Zrušiť',
					group: 'loc',
					description: null,
					plural: null,
					status: 'UNTRANSLATED',
					translations: {
						[sk.id]: { value: 'Zrušiť', status: 'TRANSLATED', updatedAt: await updatedAt(missing.id, sk.id), updatedBy: null },
						[en.id]: EMPTY,
					},
				},
				{
					keyId: empty.id,
					namespace: 'loc',
					name: 'orders.empty.title',
					group: 'loc:orders.empty',
					description: null,
					plural: null,
					status: 'UNTRANSLATED',
					translations: {
						[sk.id]: { value: 'Žiadne objednávky', status: 'TRANSLATED', updatedAt: await updatedAt(empty.id, sk.id), updatedBy: null },
						[en.id]: { value: null, status: 'UNTRANSLATED', updatedAt: await updatedAt(empty.id, en.id), updatedBy: null },
					},
				},
				{
					keyId: save.id,
					namespace: 'loc',
					name: 'Uložiť',
					group: 'loc',
					description: null,
					plural: null,
					status: 'TRANSLATED',
					translations: {
						[sk.id]: { value: 'Uložiť', status: 'TRANSLATED', updatedAt: await updatedAt(save.id, sk.id), updatedBy: null },
						[en.id]: { value: 'Save', status: 'TRANSLATED', updatedAt: await updatedAt(save.id, en.id), updatedBy: null },
					},
				},
				{
					keyId: path.id,
					namespace: 'paths',
					name: 'orders',
					group: 'paths',
					description: null,
					plural: null,
					status: 'TRANSLATED',
					translations: {
						[sk.id]: EMPTY,
						[en.id]: { value: '/orders', status: 'TRANSLATED', updatedAt: await updatedAt(path.id, en.id), updatedBy: null },
					},
				},
			],
			total: 4,
			page: 1,
			pageSize: 20,
			stats: { totalKeys: 4, translated: 2, untranslated: 2, warnings: 0 },
			namespaces: ['loc', 'paths'],
			editors: [{ id: user.id, name: user.email }],
		})
		body.items.forEach((item) => translationListItemSchema.strict().parse(item))
	})

	it('computes the group in SQL exactly like translationGroup() from shared', async () => {
		const app = createTestApp()
		const { project, sk, en, cookie } = await setup(app)
		const cases = [
			['loc', 'orders.empty.title'],
			['loc', 'orders.title'],
			['loc', 'a-b_c.D9.e'],
			['', 'orders.empty.title'],
			['', 'Uložiť'],
			['loc', 'Adresa nie je kompletná. Uistite sa'],
			['loc', 'Koniec vety.'],
			['loc', '.hidden'],
			['loc', 'trailing.'],
			['loc', 'double..dot'],
			['loc', 'objednávky.zoznam'],
			['loc', 'orders'],
			['paths', 'with space.title'],
		] as const
		for (const [namespace, name] of cases) {
			await createKey(project.id, namespace, name)
		}

		const body = await listOk(app, cookie, project.id, { sourceLanguageId: sk.id, targetLanguageId: en.id, pageSize: 100 })

		expect(body.items).toHaveLength(cases.length)
		for (const item of body.items) {
			expect({ name: item.name, group: item.group }).toEqual({ name: item.name, group: translationGroup(item.namespace, item.name) })
		}
		expect(body.items.find(({ namespace, name }) => namespace === '' && name === 'orders.empty.title')?.group).toBe('orders.empty')
		expect(body.namespaces).toEqual(['', 'loc', 'paths'])
	})

	it('filters by editor and period and lists every member and editor of the project, most edits first', async () => {
		const app = createTestApp()
		const { user, project, sk, en, cookie } = await setup(app)
		const { user: anna } = await createUser({ firstName: 'Anna', lastName: 'Nová' })
		const { user: boris } = await createUser({ firstName: 'Boris', lastName: 'Starý' })
		const prisma = getTestPrisma()
		const a = await createKey(project.id, 'loc', 'a', { [sk.id]: 'A', [en.id]: 'A' })
		const b = await createKey(project.id, 'loc', 'b', { [sk.id]: 'B', [en.id]: 'B' })
		const c = await createKey(project.id, 'loc', 'c', { [sk.id]: 'C' })
		await createKey(project.id, 'loc', 'd', { [sk.id]: 'D', [en.id]: 'D' })
		await prisma.translation.update({ where: { keyId_languageId: { keyId: a.id, languageId: en.id } }, data: { updatedById: anna.id } })
		await prisma.translation.update({ where: { keyId_languageId: { keyId: b.id, languageId: sk.id } }, data: { updatedById: anna.id } })
		await prisma.translation.update({ where: { keyId_languageId: { keyId: c.id, languageId: sk.id } }, data: { updatedById: boris.id } })
		await prisma.$executeRaw`UPDATE "Translation" t SET "updatedById" = ${boris.id}::uuid FROM "TranslationKey" k WHERE k.id = t."keyId" AND k.name = 'd' AND k."projectId" = ${project.id}::uuid`
		const { user: outsider } = await createUser({ firstName: 'Cyril' })
		// Raw SQL, because `@updatedAt` would overwrite a date set through Prisma.
		await prisma.$executeRaw`UPDATE "Translation" SET "updatedAt" = now() - interval '10 days' WHERE "keyId" = ${b.id}::uuid`
		const compact = { sourceLanguageId: sk.id, targetLanguageId: en.id }

		const byAnna = await listOk(app, cookie, project.id, { updatedById: anna.id })
		expect(names(byAnna)).toEqual(['a', 'b'])
		expect(byAnna.editors).toEqual([
			{ id: boris.id, name: 'Boris Starý' },
			{ id: anna.id, name: 'Anna Nová' },
			{ id: user.id, name: user.email },
		])
		expect(byAnna.editors.map(({ id }) => id)).not.toContain(outsider.id)
		expect(names(await listOk(app, cookie, project.id, { ...compact, updatedById: anna.id }))).toEqual(['a'])
		expect(names(await listOk(app, cookie, project.id, { updatedWithin: 'WEEK', sort: 'KEY' }))).toEqual(['a', 'c', 'd'])
		expect(names(await listOk(app, cookie, project.id, { updatedWithin: 'MONTH', sort: 'KEY' }))).toEqual(['a', 'b', 'c', 'd'])
		expect(names(await listOk(app, cookie, project.id, { updatedById: anna.id, updatedWithin: 'WEEK' }))).toEqual(['a'])
	})

	it('filters by status and namespace; total counts the filtered keys, stats ignore the filters', async () => {
		const app = createTestApp()
		const { project, sk, en, cookie } = await setup(app)
		await createKey(project.id, 'loc', 'a', { [en.id]: 'A' })
		await createKey(project.id, 'loc', 'b', { [en.id]: null })
		await createKey(project.id, 'loc', 'c')
		await createKey(project.id, 'paths', 'd', { [en.id]: 'D' })
		await createKey(project.id, 'paths', 'e')
		const query = { sourceLanguageId: sk.id, targetLanguageId: en.id }
		const stats = { totalKeys: 5, translated: 2, untranslated: 3 }

		const untranslated = await listOk(app, cookie, project.id, { ...query, status: 'UNTRANSLATED' })
		expect(names(untranslated)).toEqual(['b', 'c', 'e'])
		expect(untranslated).toMatchObject({ total: 3, stats })

		const translated = await listOk(app, cookie, project.id, { ...query, status: 'TRANSLATED', namespace: 'paths' })
		expect(names(translated)).toEqual(['d'])
		expect(translated).toMatchObject({ total: 1, stats, namespaces: ['loc', 'paths'] })

		const empty = await listOk(app, cookie, project.id, { ...query, status: '', namespace: '', search: '  ' })
		expect(empty.total).toBe(5)

		const unknown = await listOk(app, cookie, project.id, { ...query, namespace: 'unknown' })
		expect(unknown).toMatchObject({ items: [], total: 0, stats })
	})

	it('filters by warnings and counts keys with a placeholder warning in stats, ignoring the other filters', async () => {
		const app = createTestApp()
		const { project, sk, en, cookie } = await setup(app)
		const bad = await createKey(project.id, 'loc', 'items', { [sk.id]: '{{count}} ks', [en.id]: 'pcs' })
		const fine = await createKey(project.id, 'loc', 'ok', { [sk.id]: '{{count}} ks', [en.id]: '{{count}} pcs' })
		const alsoBad = await createKey(project.id, 'paths', 'orders', { [sk.id]: '{{a}}', [en.id]: '{{b}}' })
		await getTestPrisma().translation.updateMany({ where: { keyId: { in: [bad.id, alsoBad.id] }, languageId: en.id }, data: { placeholderWarning: true } })
		await getTestPrisma().translation.updateMany({ where: { placeholderWarning: null }, data: { placeholderWarning: false } })

		const all = await listOk(app, cookie, project.id, { sourceLanguageId: sk.id, targetLanguageId: en.id })
		expect(all.stats).toMatchObject({ totalKeys: 3, warnings: 2 })
		expect(all.items.map(({ name }) => name).sort()).toEqual(['items', 'ok', 'orders'])

		const flagged = await listOk(app, cookie, project.id, { sourceLanguageId: sk.id, targetLanguageId: en.id, warnings: 'true' })
		expect(flagged.items.map(({ name }) => name).sort()).toEqual(['items', 'orders'])
		expect(flagged.total).toBe(2)
		expect(flagged.stats).toMatchObject({ totalKeys: 3, warnings: 2 })

		const narrowed = await listOk(app, cookie, project.id, { warnings: '1', namespace: 'paths' })
		expect(narrowed.items.map(({ name }) => name)).toEqual(['orders'])
		expect(narrowed.stats.warnings).toBe(2)
		expect((await listOk(app, cookie, project.id, { warnings: 'false' })).total).toBe(3)
		expect(fine.id).toBeDefined()
	})

	it('searches case- and diacritics-insensitively in the key, the source and the target and treats % and _ literally', async () => {
		const app = createTestApp()
		const { project, sk, en, cookie } = await setup(app)
		const ru = await createLanguage(project.id, 'ru')
		await createKey(project.id, 'loc', 'orders.title', { [sk.id]: 'Objednávky', [en.id]: 'Orders' })
		await createKey(project.id, 'loc', 'Uložiť', { [sk.id]: 'Uložiť', [en.id]: 'Save' })
		await createKey(project.id, 'loc', 'discount', { [sk.id]: 'Zľava 50%', [en.id]: 'Discount 50 percent' })
		await createKey(project.id, 'loc', 'snake_case', { [sk.id]: 'x', [ru.id]: 'Только русский' })
		const search = (value: string) => listOk(app, cookie, project.id, { sourceLanguageId: sk.id, targetLanguageId: en.id, search: value, sort: 'KEY' })

		expect(names(await search('ORDERS.'))).toEqual(['orders.title'])
		expect(names(await search('objednáv'))).toEqual(['orders.title'])
		expect(names(await search('OBJEDNAVKY'))).toEqual(['orders.title'])
		expect(names(await search('ulozit'))).toEqual(['Uložiť'])
		expect(names(await search('zlava'))).toEqual(['discount'])
		expect(names(await search('save'))).toEqual(['Uložiť'])
		expect(names(await search('50%'))).toEqual(['discount'])
		expect(names(await search('%'))).toEqual(['discount'])
		expect(names(await search('_'))).toEqual(['snake_case'])
		expect(names(await search('\\'))).toEqual([])
		expect(names(await search('русский'))).toEqual([])
		expect((await search('  save  ')).total).toBe(1)
	})

	it('sorts by KEY (namespace, key) and UPDATED (target updatedAt, newest first, missing rows last)', async () => {
		const app = createTestApp()
		const { project, sk, en, cookie } = await setup(app)
		const prisma = getTestPrisma()
		await createKey(project.id, 'paths', 'a')
		const old = await createKey(project.id, 'loc', 'z', { [en.id]: 'Z' })
		const recent = await createKey(project.id, 'loc', 'y', { [en.id]: null })
		await createKey(project.id, 'loc', 'b')
		const setUpdatedAt = (keyId: string, updatedAt: string) =>
			prisma.translation.update({ where: { keyId_languageId: { keyId, languageId: en.id } }, data: { updatedAt: new Date(updatedAt) } })
		await setUpdatedAt(old.id, '2026-01-01T00:00:00.000Z')
		await setUpdatedAt(recent.id, '2026-06-01T00:00:00.000Z')
		const query = { sourceLanguageId: sk.id, targetLanguageId: en.id }

		expect(names(await listOk(app, cookie, project.id, { ...query, sort: 'KEY' }))).toEqual(['b', 'y', 'z', 'a'])
		const updated = await listOk(app, cookie, project.id, { ...query, sort: 'UPDATED' })
		expect(names(updated)).toEqual(['y', 'z', 'a', 'b'])
		expect(updated.items.map(({ translations }) => translations[en.id]?.updatedAt)).toEqual([
			'2026-06-01T00:00:00.000Z',
			'2026-01-01T00:00:00.000Z',
			null,
			null,
		])
		expect(names(await listOk(app, cookie, project.id, query))).toEqual(['b', 'y', 'a', 'z'])
	})

	it('sorts KEY by namespace, then group, so path keys of one object stay together after the sentence keys', async () => {
		const app = createTestApp()
		const { project, sk, en, cookie } = await setup(app)
		for (const name of ['orders.title', 'b', 'orders.empty.title', 'z', 'invoices.title']) {
			await createKey(project.id, 'loc', name)
		}
		await createKey(project.id, 'paths', 'a')

		const body = await listOk(app, cookie, project.id, { sourceLanguageId: sk.id, targetLanguageId: en.id, sort: 'KEY' })

		expect(body.items.map(({ group, name }) => `${group} ${name}`)).toEqual([
			'loc b',
			'loc z',
			'loc:invoices invoices.title',
			'loc:orders orders.title',
			'loc:orders.empty orders.empty.title',
			'paths a',
		])
	})

	it('uses the key id as the last tiebreaker, so pages never overlap', async () => {
		const app = createTestApp()
		const { project, sk, en, cookie } = await setup(app)
		const other = await createLanguage(project.id, 'ru')
		for (let i = 0; i < 7; i += 1) {
			await createKey(project.id, `ns${i}`, 'same')
			await createKey(project.id, '', `same-${i}`, { [other.id]: 'x' })
		}
		for (const sort of ['UNTRANSLATED_FIRST', 'KEY', 'UPDATED'] as const) {
			const query = { sourceLanguageId: sk.id, targetLanguageId: en.id, sort, pageSize: 3 }
			const pages = await Promise.all([1, 2, 3, 4, 5].map((page) => listOk(app, cookie, project.id, { ...query, page })))
			const ids = pages.flatMap(({ items }) => items.map(({ keyId }) => keyId))
			expect(ids).toHaveLength(14)
			expect(new Set(ids).size).toBe(14)
		}
	})

	it('paginates with page and pageSize; a page past the end is empty but keeps total', async () => {
		const app = createTestApp()
		const { project, sk, en, cookie } = await setup(app)
		for (const name of ['a', 'b', 'c', 'd', 'e']) {
			await createKey(project.id, 'loc', name)
		}
		const query = { sourceLanguageId: sk.id, targetLanguageId: en.id, sort: 'KEY' }

		const second = await listOk(app, cookie, project.id, { ...query, page: '2', pageSize: '2' })
		expect(second).toMatchObject({ total: 5, page: 2, pageSize: 2 })
		expect(names(second)).toEqual(['c', 'd'])
		expect(names(await listOk(app, cookie, project.id, { ...query, page: 3, pageSize: 2 }))).toEqual(['e'])
		expect(await listOk(app, cookie, project.id, { ...query, page: 4, pageSize: 2 })).toMatchObject({ items: [], total: 5 })
	})

	it('allows the same language as source and target and counts stats for a project without keys', async () => {
		const app = createTestApp()
		const { user, project, sk, cookie } = await setup(app)

		expect(await listOk(app, cookie, project.id, { sourceLanguageId: sk.id, targetLanguageId: sk.id })).toEqual({
			items: [],
			total: 0,
			page: 1,
			pageSize: 20,
			stats: { totalKeys: 0, translated: 0, untranslated: 0, warnings: 0 },
			namespaces: [],
			editors: [{ id: user.id, name: user.email }],
		})
	})

	describe('without languages (extended view)', () => {
		it('marks a row untranslated when any language misses a value and counts stats the same way', async () => {
			const app = createTestApp()
			const { project, sk, en, cookie } = await setup(app)
			const ru = await createLanguage(project.id, 'ru')
			const full = await createKey(project.id, 'loc', 'full', { [sk.id]: 'A', [en.id]: 'A', [ru.id]: 'A' })
			const noRow = await createKey(project.id, 'loc', 'noRow', { [sk.id]: 'B', [en.id]: 'B' })
			const nullValue = await createKey(project.id, 'loc', 'nullValue', { [sk.id]: 'C', [en.id]: 'C', [ru.id]: null })

			const body = await listOk(app, cookie, project.id, {})

			expect(body.items.map(({ keyId, status }) => [keyId, status])).toEqual([
				[noRow.id, 'UNTRANSLATED'],
				[nullValue.id, 'UNTRANSLATED'],
				[full.id, 'TRANSLATED'],
			])
			expect(Object.keys(body.items[0]?.translations ?? {}).sort()).toEqual([sk.id, en.id, ru.id].sort())
			expect(body.items[0]?.translations[ru.id]).toEqual({ value: null, status: 'UNTRANSLATED', updatedAt: null, updatedBy: null })
			expect(body.stats).toEqual({ totalKeys: 3, translated: 1, untranslated: 2, warnings: 0 })
			expect(names(await listOk(app, cookie, project.id, { status: 'UNTRANSLATED' }))).toEqual(['noRow', 'nullValue'])
			expect(names(await listOk(app, cookie, project.id, { status: 'TRANSLATED' }))).toEqual(['full'])
		})

		it('searches the key and the value of every language, ignoring diacritics', async () => {
			const app = createTestApp()
			const { project, sk, en, cookie } = await setup(app)
			const ru = await createLanguage(project.id, 'ru')
			await createKey(project.id, 'loc', 'orders.title', { [sk.id]: 'Objednávky', [en.id]: 'Orders', [ru.id]: 'Заказы' })
			await createKey(project.id, 'loc', 'Uložiť', { [sk.id]: 'Uložiť', [en.id]: 'Save', [ru.id]: 'Сохранить' })

			expect(names(await listOk(app, cookie, project.id, { search: 'заказы' }))).toEqual(['orders.title'])
			expect(names(await listOk(app, cookie, project.id, { search: 'save' }))).toEqual(['Uložiť'])
			expect(names(await listOk(app, cookie, project.id, { search: 'ORDERS.' }))).toEqual(['orders.title'])
			expect(names(await listOk(app, cookie, project.id, { search: 'objednavky' }))).toEqual(['orders.title'])
			expect(names(await listOk(app, cookie, project.id, { search: 'nič' }))).toEqual([])
		})

		it('sorts UPDATED by the newest change in any language', async () => {
			const app = createTestApp()
			const { project, sk, en, cookie } = await setup(app)
			const prisma = getTestPrisma()
			const skNewer = await createKey(project.id, 'loc', 'a', { [sk.id]: 'A', [en.id]: 'A' })
			const enNewer = await createKey(project.id, 'loc', 'b', { [sk.id]: 'B', [en.id]: 'B' })
			await createKey(project.id, 'loc', 'c')
			const setUpdatedAt = (keyId: string, languageId: string, updatedAt: string) =>
				prisma.translation.update({ where: { keyId_languageId: { keyId, languageId } }, data: { updatedAt: new Date(updatedAt) } })
			await setUpdatedAt(skNewer.id, sk.id, '2026-03-01T00:00:00.000Z')
			await setUpdatedAt(skNewer.id, en.id, '2026-01-01T00:00:00.000Z')
			await setUpdatedAt(enNewer.id, sk.id, '2026-01-01T00:00:00.000Z')
			await setUpdatedAt(enNewer.id, en.id, '2026-06-01T00:00:00.000Z')

			expect(names(await listOk(app, cookie, project.id, { sort: 'UPDATED' }))).toEqual(['b', 'a', 'c'])
		})

		it('returns an empty list for a project without languages', async () => {
			const app = createTestApp()
			const { user } = await createUser({ role: ROLE.ADMIN })
			const project = await createProject()
			const cookie = await loginAs(app, { email: user.email, password: TEST_PASSWORD })

			expect(await listOk(app, cookie, project.id, {})).toEqual({
				items: [],
				total: 0,
				page: 1,
				pageSize: 20,
				stats: { totalKeys: 0, translated: 0, untranslated: 0, warnings: 0 },
				namespaces: [],
				editors: [],
			})
		})
	})

	it('returns 404 NOT_FOUND to an EDITOR who is not a member and 200 to an ADMIN who is not', async () => {
		const app = createTestApp()
		const editor = await setup(app, ROLE.EDITOR, { member: false })
		const admin = await setup(app, ROLE.ADMIN, { member: false })

		expectErrorCode(
			await list(app, editor.cookie, editor.project.id, { sourceLanguageId: editor.sk.id, targetLanguageId: editor.en.id }),
			404,
			ERROR_CODE.NOT_FOUND,
		)
		await listOk(app, admin.cookie, admin.project.id, { sourceLanguageId: admin.sk.id, targetLanguageId: admin.en.id })
	})

	it('returns 401 AUTH_UNAUTHENTICATED without a session', async () => {
		const project = await createProject()

		expectErrorCode(await request(createTestApp()).get(`/api/projects/${project.id}/translations`), 401, ERROR_CODE.AUTH_UNAUTHENTICATED)
	})

	it.each([
		{ name: 'a source language of another project', which: 'source' },
		{ name: 'a target language of another project', which: 'target' },
		{ name: 'an unknown target language', which: 'unknown' },
	])('returns 404 NOT_FOUND for $name', async ({ which }) => {
		const app = createTestApp()
		const { project, sk, en, cookie } = await setup(app)
		const foreign = (await createLanguage((await createProject()).id, 'sk', true)).id
		const query = {
			source: { sourceLanguageId: foreign, targetLanguageId: en.id },
			target: { sourceLanguageId: sk.id, targetLanguageId: foreign },
			unknown: { sourceLanguageId: sk.id, targetLanguageId: randomUUID() },
		}[which]

		expectErrorCode(await list(app, cookie, project.id, query ?? {}), 404, ERROR_CODE.NOT_FOUND)
	})

	it('returns 400 VALIDATION_ERROR with details for an invalid query', async () => {
		const app = createTestApp()
		const { project, sk, en, cookie } = await setup(app)
		const details = async (query: Parameters<typeof list>[3]) => {
			const res = await list(app, cookie, project.id, query)
			expectErrorCode(res, 400, ERROR_CODE.VALIDATION_ERROR)
			return detailPaths(res)
		}
		const valid = { sourceLanguageId: sk.id, targetLanguageId: en.id }

		expect(await details({ sourceLanguageId: sk.id })).toEqual(['targetLanguageId'])
		expect(await details({ targetLanguageId: en.id })).toEqual(['sourceLanguageId'])
		expect(await details({ ...valid, targetLanguageId: 'not-a-uuid' })).toEqual(['targetLanguageId'])
		expect(await details({ ...valid, status: 'REVIEW', sort: 'NAME' })).toEqual(['status', 'sort'])
		expect(await details({ ...valid, page: 0, pageSize: 101 })).toEqual(['page', 'pageSize'])
		expect(await details({ ...valid, search: 'x'.repeat(201) })).toEqual(['search'])
		const res = await request(app)
			.get(`/api/projects/${project.id}/translations?sourceLanguageId=${sk.id}&targetLanguageId=${en.id}&search=a&search=b`)
			.set('Cookie', cookie)
		expectErrorCode(res, 400, ERROR_CODE.VALIDATION_ERROR)
		expect(detailPaths(res)).toEqual(['search'])
	})

	it('answers quickly for 2 500 keys in 10 languages', async () => {
		const app = createTestApp()
		const { project, sk, en, cookie } = await setup(app)
		const prisma = getTestPrisma()
		for (const tag of ['bg', 'cs', 'de-AT', 'hr', 'hu', 'ro', 'ru', 'pl']) {
			await createLanguage(project.id, tag)
		}
		await prisma.$executeRaw`
			INSERT INTO "TranslationKey" (id, "projectId", namespace, name, "updatedAt")
			SELECT gen_random_uuid(), ${project.id}::uuid, CASE WHEN i % 4 = 0 THEN 'paths' ELSE 'loc' END,
				CASE WHEN i % 3 = 0 THEN 'module' || (i % 50) || '.section.key' || i ELSE 'Veta číslo ' || i || '. Pokračovanie textu' END, now()
			FROM generate_series(1, 2500) AS i`
		await prisma.$executeRaw`
			INSERT INTO "Translation" ("keyId", "languageId", value, "updatedAt")
			SELECT k.id, l.id, CASE WHEN random() < 0.1 THEN NULL ELSE 'Preklad ' || l.tag || ' ' || k.name || ' {{count}}' END, now() - random() * interval '30 days'
			FROM "TranslationKey" k CROSS JOIN "ProjectLanguage" l
			WHERE k."projectId" = ${project.id}::uuid AND l."projectId" = ${project.id}::uuid AND random() < 0.95`
		await prisma.$executeRawUnsafe('ANALYZE "TranslationKey", "Translation"')
		const query = { sourceLanguageId: sk.id, targetLanguageId: en.id }
		const variants = {
			default: query,
			search: { ...query, search: 'section' },
			searchNoMatch: { ...query, search: 'nič také' },
			updatedPage10: { ...query, sort: 'UPDATED', page: 10 },
			untranslatedPaths: { ...query, status: 'UNTRANSLATED', namespace: 'paths' },
			extended: {},
			extendedSearch: { search: 'section' },
			extendedUpdatedPage10: { sort: 'UPDATED', page: 10 },
			extendedTranslated: { status: 'TRANSLATED' },
		}
		await listOk(app, cookie, project.id, query)

		const timings: Record<string, number> = {}
		for (const [name, variant] of Object.entries(variants)) {
			const start = performance.now()
			const body = await listOk(app, cookie, project.id, variant)
			timings[name] = Math.round(performance.now() - start)
			expect(body.stats.totalKeys).toBe(2500)
		}
		console.info('GET translations, 2 500 keys x 10 languages, ms per request:', timings)
		expect(Math.max(...Object.values(timings))).toBeLessThan(1000)
	})
})
