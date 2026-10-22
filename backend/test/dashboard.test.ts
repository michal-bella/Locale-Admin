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

const createEvent = (projectId: string, createdAt: Date, { userId = null, count = 1 }: { userId?: string | null; count?: number } = {}) =>
	getTestPrisma().activityEvent.create({
		data: { projectId, userId, createdAt, count, type: ACTIVITY_TYPE.LANGUAGE_ADDED, payload: { tag: 'en' } },
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
	it('pages newest first by createdAt and id without duplicates or gaps', async () => {
		const app = createTestApp()
		const { user, cookie } = await login(app, ROLE.EDITOR, { firstName: 'Jana', lastName: 'Nováková' })
		const project = await createProject([user.id])
		const at = (minutes: number) => new Date(Date.UTC(2026, 9, 20, 10, minutes))
		const created = [
			await createEvent(project.id, at(0), { userId: user.id }),
			await createEvent(project.id, at(5)),
			await createEvent(project.id, at(5)),
			await createEvent(project.id, at(5)),
			await createEvent(project.id, at(9), { count: 90 }),
		]
		await createEvent((await createProject()).id, at(7))
		const expected = [...created].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : -1)).map((event) => event.id)

		const ids: string[] = []
		let cursor: string | null = null
		let pages = 0
		do {
			const res = await get(app, cookie, `/${project.id}/activity?limit=2${cursor ? `&cursor=${cursor}` : ''}`)
			expect(res.status).toBe(200)
			const body = res.body as { items: { id: string }[]; nextCursor: string | null }
			ids.push(...body.items.map((item) => item.id))
			cursor = body.nextCursor
			pages += 1
		} while (cursor)

		expect(ids).toEqual(expected)
		expect(pages).toBe(3)
		const first = await get(app, cookie, `/${project.id}/activity`)
		expect(first.body).toEqual({
			items: expect.any(Array) as unknown,
			nextCursor: null,
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

	it('ends with a null cursor when the last page is full', async () => {
		const app = createTestApp()
		const { user, cookie } = await login(app)
		const project = await createProject([user.id])
		await createEvent(project.id, new Date('2026-10-20T10:00:00Z'))
		await createEvent(project.id, new Date('2026-10-20T11:00:00Z'))

		const res = await get(app, cookie, `/${project.id}/activity?limit=2`)

		expect((res.body as { items: unknown[] }).items).toHaveLength(2)
		expect((res.body as { nextCursor: unknown }).nextCursor).toBeNull()
	})

	it('validates the limit and rejects a foreign or unknown cursor', async () => {
		const app = createTestApp()
		const { user, cookie } = await login(app)
		const project = await createProject([user.id])
		const foreign = await createEvent((await createProject()).id, new Date())
		const url = `/${project.id}/activity`

		expect((await get(app, cookie, `${url}?limit=0`)).status).toBe(400)
		expect(errorResponseSchema.parse((await get(app, cookie, `${url}?limit=51`)).body).error.details).toEqual([
			{ path: 'limit', code: VALIDATION_CODE.TOO_LONG, params: { max: 50 } },
		])
		expect((await get(app, cookie, `${url}?limit=50`)).status).toBe(200)
		expectValidationError(await get(app, cookie, `${url}?cursor=${foreign.id}`), 'cursor')
		expectValidationError(await get(app, cookie, `${url}?cursor=${randomUUID()}`), 'cursor')
		expectValidationError(await get(app, cookie, `${url}?cursor=abc`), 'cursor')
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
