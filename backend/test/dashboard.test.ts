import { randomUUID } from 'node:crypto'

import request from 'supertest'
import { describe, expect, it } from 'vitest'

import { ACTIVITY_TYPE, ERROR_CODE, ROLE, VALIDATION_CODE, errorResponseSchema } from '@locale/shared'

import { createTestApp } from './helpers/app'
import { loginAs } from './helpers/auth'
import { getTestPrisma } from './helpers/db'
import { TEST_PASSWORD, createUser } from './helpers/users'
import { createVersionRow, versionIdOf } from './helpers/versions'

type App = ReturnType<typeof createTestApp>

const DAY_MS = 86_400_000

const login = async (app: App, role: ROLE = ROLE.EDITOR, names: { firstName?: string; lastName?: string } = {}) => {
	const { user } = await createUser({ role, ...names })
	return { user, cookie: await loginAs(app, { email: user.email, password: TEST_PASSWORD }) }
}

const createProject = async (memberIds: string[] = []) => {
	const project = await getTestPrisma().project.create({
		data: { name: 'A', slug: `a-${randomUUID().slice(0, 8)}`, members: { create: memberIds.map((userId) => ({ userId })) } },
	})
	await createVersionRow(project.id)
	return project
}

const createLanguage = (projectId: string, tag: string, position: number, isBase = false) =>
	getTestPrisma().projectLanguage.create({ data: { projectId, tag, position, isBase } })

const createKey = async (projectId: string, name: string, values: Record<string, string | null> = {}, createdAt?: Date) =>
	getTestPrisma().translationKey.create({
		data: {
			projectId,
			versionId: await versionIdOf(projectId),
			namespace: 'loc',
			name,
			createdAt,
			translations: { create: Object.entries(values).map(([languageId, value]) => ({ languageId, value })) },
		},
	})

const createEvent = (
	projectId: string,
	createdAt: Date,
	{
		userId = null,
		count = 1,
		versionId = null,
		imported = false,
	}: { userId?: string | null; count?: number; versionId?: string | null; imported?: boolean } = {},
) =>
	getTestPrisma().activityEvent.create({
		data: imported
			? {
					projectId,
					userId,
					versionId,
					createdAt,
					count,
					type: ACTIVITY_TYPE.KEYS_IMPORTED,
					payload: { keysCreated: 1, translationsCreated: count, translationsUpdated: 0, languageTags: ['sk'] },
				}
			: { projectId, userId, versionId, createdAt, count, type: ACTIVITY_TYPE.LANGUAGE_ADDED, payload: { tag: 'en' } },
	})

const get = (app: App, cookie: string, path: string) => request(app).get(`/api/projects${path}`).set('Cookie', cookie)

const expectValidationError = (res: request.Response, path: string) => {
	expect(res.status).toBe(400)
	const { error } = errorResponseSchema.parse(res.body)
	expect(error.code).toBe(ERROR_CODE.VALIDATION_ERROR)
	expect(error.details).toEqual([expect.objectContaining({ path, code: VALIDATION_CODE.INVALID })])
}

/** `YYYY-MM-DD` of `date` in `timeZone`. */
const localDate = (date: Date, timeZone: string) => new Intl.DateTimeFormat('en-CA', { timeZone }).format(date)

/** The `days` dates ending today in `timeZone`, oldest first. */
const lastDays = (days: number, timeZone: string) => {
	const today = new Date(`${localDate(new Date(), timeZone)}T00:00:00Z`).getTime()
	return Array.from({ length: days }, (_, index) => new Date(today - (days - 1 - index) * DAY_MS).toISOString().slice(0, 10))
}

describe('GET /api/projects/:projectId/dashboard', () => {
	it('counts keys, translated keys, strings and base words of the project only', async () => {
		const app = createTestApp()
		const { user, cookie } = await login(app)
		const project = await createProject([user.id])
		const sk = await createLanguage(project.id, 'sk', 0, true)
		const en = await createLanguage(project.id, 'en', 1)
		const de = await createLanguage(project.id, 'de', 2)
		await createKey(project.id, 'save', { [sk.id]: 'Uložiť zmeny', [en.id]: 'Save changes', [de.id]: 'Speichern' })
		await createKey(project.id, 'hello', { [sk.id]: '  Ahoj \n  svet ', [en.id]: 'Hello', [de.id]: null })
		await createKey(project.id, 'only-en', { [sk.id]: null, [en.id]: 'x' })
		await createKey(project.id, 'empty')
		await createKey(project.id, 'old', { [sk.id]: 'Jedno', [en.id]: 'One', [de.id]: 'Eins' }, new Date(Date.now() - 40 * DAY_MS))
		const other = await createProject()
		const otherSk = await createLanguage(other.id, 'sk', 0, true)
		await createKey(other.id, 'save', { [otherSk.id]: 'Iný projekt s piatimi slovami' })

		const res = await get(app, cookie, `/${project.id}/dashboard`)

		expect(res.status).toBe(200)
		expect(res.body).toEqual({
			version: { id: await versionIdOf(project.id), name: 'v1' },
			keys: { total: 5, createdLast30Days: 4 },
			translatedKeys: 2,
			strings: { filled: 9, total: 15 },
			baseWords: 5,
		})

		await createLanguage(project.id, 'cs', 3)
		const withEmptyLanguage = await get(app, cookie, `/${project.id}/dashboard`)
		expect(withEmptyLanguage.body).toEqual({
			version: { id: await versionIdOf(project.id), name: 'v1' },
			keys: { total: 5, createdLast30Days: 4 },
			translatedKeys: 0,
			strings: { filled: 9, total: 20 },
			baseWords: 5,
		})
	})

	it('returns zeros for an empty project and for keys without languages', async () => {
		const app = createTestApp()
		const { user, cookie } = await login(app)
		const empty = await createProject([user.id])
		await createLanguage(empty.id, 'sk', 0, true)
		const withoutLanguages = await createProject([user.id])
		await createKey(withoutLanguages.id, 'a')
		await createKey(withoutLanguages.id, 'b', {}, new Date(Date.now() - 31 * DAY_MS))

		const emptyRes = await get(app, cookie, `/${empty.id}/dashboard`)
		const withoutLanguagesRes = await get(app, cookie, `/${withoutLanguages.id}/dashboard`)

		expect(emptyRes.body).toEqual({
			version: { id: await versionIdOf(empty.id), name: 'v1' },
			keys: { total: 0, createdLast30Days: 0 },
			translatedKeys: 0,
			strings: { filled: 0, total: 0 },
			baseWords: 0,
		})
		expect(withoutLanguagesRes.body).toEqual({
			version: { id: await versionIdOf(withoutLanguages.id), name: 'v1' },
			keys: { total: 2, createdLast30Days: 1 },
			translatedKeys: 0,
			strings: { filled: 0, total: 0 },
			baseWords: 0,
		})
	})
})

describe('GET /api/projects/:projectId/activity', () => {
	it('pages newest first by createdAt and id with the total and the users of the project', async () => {
		const app = createTestApp()
		const { user, cookie } = await login(app, ROLE.EDITOR, { firstName: 'Jana', lastName: 'Nováková' })
		const { user: other } = await createUser({ firstName: 'Adam', lastName: 'Biely' })
		const project = await createProject([user.id])
		const at = (minutes: number) => new Date(Date.UTC(2026, 9, 20, 10, minutes))
		const created = [
			await createEvent(project.id, at(0), { userId: user.id }),
			await createEvent(project.id, at(5), { userId: other.id }),
			await createEvent(project.id, at(5)),
			await createEvent(project.id, at(5)),
			await createEvent(project.id, at(9), { count: 90 }),
		]
		await createEvent((await createProject()).id, at(7), { userId: (await createUser()).user.id })
		const expected = [...created].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : -1)).map((event) => event.id)

		const pages = await Promise.all([1, 2, 3, 4].map((page) => get(app, cookie, `/${project.id}/activity?pageSize=2&page=${page}`)))

		const bodies = pages.map((res) => res.body as { items: { id: string }[]; total: number; page: number; pageSize: number })
		expect(bodies.flatMap((body) => body.items.map((item) => item.id))).toEqual(expected)
		expect(bodies.map((body) => [body.items.length, body.total, body.page, body.pageSize])).toEqual([
			[2, 5, 1, 2],
			[2, 5, 2, 2],
			[1, 5, 3, 2],
			[0, 5, 4, 2],
		])
		const first = await get(app, cookie, `/${project.id}/activity`)
		expect(first.body).toEqual({
			items: expect.any(Array) as unknown,
			total: 5,
			page: 1,
			pageSize: 20,
			users: [
				{ id: other.id, name: 'Adam Biely' },
				{ id: user.id, name: 'Jana Nováková' },
			],
		})
		expect((first.body as { items: unknown[] }).items.at(-1)).toEqual({
			id: created[0]?.id,
			createdAt: '2026-10-20T10:00:00.000Z',
			count: 1,
			version: null,
			user: { id: user.id, name: 'Jana Nováková' },
			type: ACTIVITY_TYPE.LANGUAGE_ADDED,
			payload: { tag: 'en' },
		})
		expect((first.body as { items: { count: number }[] }).items[0]?.count).toBe(90)
	})

	it('filters by user, category, version and period, combined, with the total of the matches', async () => {
		const app = createTestApp()
		const { user, cookie } = await login(app)
		const project = await createProject([user.id])
		const versionId = await versionIdOf(project.id)
		const day = (date: number, hour = 10) => new Date(Date.UTC(2026, 9, date, hour))
		const own = await createEvent(project.id, day(1), { userId: user.id })
		const ownImport = await createEvent(project.id, day(2), { userId: user.id, imported: true, versionId })
		const otherImport = await createEvent(project.id, day(3), { imported: true, versionId })
		const lastDay = await createEvent(project.id, day(4, 23))
		const url = `/${project.id}/activity`
		const ids = async (query: string) => {
			const body = (await get(app, cookie, `${url}?${query}`)).body as { items: { id: string }[]; total: number }
			expect(body.total).toBe(body.items.length)
			return body.items.map((item) => item.id)
		}

		expect(await ids(`userId=${user.id}`)).toEqual([ownImport.id, own.id])
		expect(await ids('category=IMPORT')).toEqual([otherImport.id, ownImport.id])
		expect(await ids('category=LANGUAGE')).toEqual([lastDay.id, own.id])
		expect(await ids(`versionId=${versionId}`)).toEqual([otherImport.id, ownImport.id])
		expect(await ids(`userId=${user.id}&category=IMPORT&versionId=${versionId}`)).toEqual([ownImport.id])
		// `from` inclusive, `to` exclusive.
		expect(await ids(`from=${day(2).toISOString()}&to=${day(4, 23).toISOString()}`)).toEqual([otherImport.id, ownImport.id])
		expect(await ids(`from=${day(4, 23).toISOString()}`)).toEqual([lastDay.id])
		expect(await ids(`userId=${randomUUID()}`)).toEqual([])
	})

	it('validates the page, the page size and the filters', async () => {
		const app = createTestApp()
		const { user, cookie } = await login(app)
		const project = await createProject([user.id])
		const url = `/${project.id}/activity`

		expect((await get(app, cookie, `${url}?pageSize=0`)).status).toBe(400)
		expect(errorResponseSchema.parse((await get(app, cookie, `${url}?pageSize=51`)).body).error.details).toEqual([
			{ path: 'pageSize', code: VALIDATION_CODE.TOO_LONG, params: { max: 50 } },
		])
		expect((await get(app, cookie, `${url}?pageSize=50`)).status).toBe(200)
		expect((await get(app, cookie, `${url}?page=0`)).status).toBe(400)
		expectValidationError(await get(app, cookie, `${url}?userId=abc`), 'userId')
		expectValidationError(await get(app, cookie, `${url}?versionId=abc`), 'versionId')
		expectValidationError(await get(app, cookie, `${url}?category=TRANSLATION_UPDATED`), 'category')
		expectValidationError(await get(app, cookie, `${url}?from=2026-10-01`), 'from')
		expectValidationError(await get(app, cookie, `${url}?to=abc`), 'to')
	})

	it('returns user null after the user was deleted', async () => {
		const app = createTestApp()
		const { user, cookie } = await login(app)
		const { user: deleted } = await createUser()
		const project = await createProject([user.id])
		await createEvent(project.id, new Date(), { userId: deleted.id })
		await getTestPrisma().user.delete({ where: { id: deleted.id } })

		const res = await get(app, cookie, `/${project.id}/activity`)

		expect((res.body as { items: { user: unknown }[] }).items.map((item) => item.user)).toEqual([null])
	})
})

describe('GET /api/projects/:projectId/activity/daily', () => {
	it('returns every day of the range with the sum of count, zero days included', async () => {
		const app = createTestApp()
		const { user, cookie } = await login(app)
		const project = await createProject([user.id])
		const days = lastDays(7, 'UTC')
		const noon = (date: string | undefined) => new Date(`${date}T12:00:00Z`)
		await createEvent(project.id, noon(days[1]), { count: 90 })
		await createEvent(project.id, noon(days[1]), { userId: user.id })
		await createEvent(project.id, noon(days[6]), { count: 3 })
		await createEvent(project.id, new Date(noon(days[0]).getTime() - DAY_MS))
		await createEvent((await createProject()).id, noon(days[6]))

		const res = await get(app, cookie, `/${project.id}/activity/daily?range=7d`)

		expect(res.status).toBe(200)
		expect((res.body as { days: unknown }).days).toEqual(days.map((date, index) => ({ date, changes: index === 1 ? 91 : index === 6 ? 3 : 0 })))
		const defaults = await get(app, cookie, `/${project.id}/activity/daily`)
		expect((defaults.body as { days: { date: string }[] }).days.map((day) => day.date)).toEqual(lastDays(30, 'UTC'))
		const ninety = await get(app, cookie, `/${project.id}/activity/daily?range=90d&timeZone=Europe/Bratislava`)
		expect((ninety.body as { days: { date: string }[] }).days.map((day) => day.date)).toEqual(lastDays(90, 'Europe/Bratislava'))
	})

	it('puts an event at 23:30 UTC on the next day in Europe/Bratislava', async () => {
		const app = createTestApp()
		const { user, cookie } = await login(app)
		const project = await createProject([user.id])
		const day = lastDays(7, 'UTC')[3]
		const nextDay = lastDays(7, 'UTC')[4]
		await createEvent(project.id, new Date(`${day}T23:30:00Z`))

		const changesOn = async (timeZone: string) => {
			const res = await get(app, cookie, `/${project.id}/activity/daily?range=7d&timeZone=${encodeURIComponent(timeZone)}`)
			expect(res.status).toBe(200)
			return Object.fromEntries((res.body as { days: { date: string; changes: number }[] }).days.map((entry) => [entry.date, entry.changes]))
		}

		expect(await changesOn('UTC')).toMatchObject({ [`${day}`]: 1, [`${nextDay}`]: 0 })
		expect(await changesOn('Europe/Bratislava')).toMatchObject({ [`${day}`]: 0, [`${nextDay}`]: 1 })
	})

	it('lists the top 5 contributors by changes, ties by name, without deleted users and zero counts', async () => {
		const app = createTestApp()
		const { user, cookie } = await login(app, ROLE.EDITOR, { firstName: 'Zuzana' })
		const project = await createProject([user.id])
		const names = ['Adam', 'Beáta', 'Cyril', 'Dana', 'Emil', 'Filip']
		const users = await Promise.all(names.map(async (firstName) => (await createUser({ firstName })).user))
		const now = new Date()
		const changes = [5, 3, 3, 1, 1, 1]
		for (const [index, contributor] of users.entries()) {
			await createEvent(project.id, now, { userId: contributor.id, count: changes[index] })
		}
		await createEvent(project.id, now, { userId: user.id, count: 0 })
		await createEvent(project.id, now, { count: 100 })
		await createEvent(project.id, new Date(now.getTime() - 10 * DAY_MS), { userId: users[5]?.id, count: 50 })

		const res = await get(app, cookie, `/${project.id}/activity/daily?range=7d`)

		expect((res.body as { contributors: unknown }).contributors).toEqual([
			{ user: { id: users[0]?.id, name: 'Adam' }, changes: 5 },
			{ user: { id: users[1]?.id, name: 'Beáta' }, changes: 3 },
			{ user: { id: users[2]?.id, name: 'Cyril' }, changes: 3 },
			{ user: { id: users[3]?.id, name: 'Dana' }, changes: 1 },
			{ user: { id: users[4]?.id, name: 'Emil' }, changes: 1 },
		])
	})

	it('rejects an unknown range and an invalid zone', async () => {
		const app = createTestApp()
		const { user, cookie } = await login(app)
		const project = await createProject([user.id])
		const url = `/${project.id}/activity/daily`

		expectValidationError(await get(app, cookie, `${url}?range=1y`), 'range')
		expectValidationError(await get(app, cookie, `${url}?timeZone=Europe/Nowhere`), 'timeZone')
		expectValidationError(await get(app, cookie, `${url}?timeZone=${encodeURIComponent('+01:00')}`), 'timeZone')
	})
})

describe('dashboard and activity access', () => {
	it.each(['dashboard', 'activity', 'activity/daily'])('/%s: 404 for a non-member, 200 for a member and an ADMIN', async (path) => {
		const app = createTestApp()
		const member = await login(app)
		const outsider = await login(app)
		const admin = await login(app, ROLE.ADMIN)
		const project = await createProject([member.user.id])

		const outsiderRes = await get(app, outsider.cookie, `/${project.id}/${path}`)
		expect(outsiderRes.status).toBe(404)
		expect(errorResponseSchema.parse(outsiderRes.body).error.code).toBe(ERROR_CODE.NOT_FOUND)
		expect((await get(app, member.cookie, `/${project.id}/${path}`)).status).toBe(200)
		expect((await get(app, admin.cookie, `/${project.id}/${path}`)).status).toBe(200)
		expect((await request(app).get(`/api/projects/${project.id}/${path}`)).status).toBe(401)
	})
})
