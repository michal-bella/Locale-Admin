import { randomUUID } from 'node:crypto'

import request from 'supertest'
import { describe, expect, it } from 'vitest'

import {
	ACTIVITY_TYPE,
	type CreateProjectVersionRequestInput,
	ERROR_CODE,
	PROJECT_ROLE,
	ROLE,
	type UpdateProjectVersionRequestInput,
	VALIDATION_CODE,
	VERSION_LOCK,
	errorResponseSchema,
	projectVersionSchema,
	projectVersionsResponseSchema,
	toVersionDate,
} from '@locale/shared'

import { findDefaultVersionId, resolveVersion, toDbDate } from '../src/lib/projectVersions'

import { createTestApp } from './helpers/app'
import { CSRF_HEADERS, loginAs } from './helpers/auth'
import { getTestPrisma } from './helpers/db'
import { TEST_PASSWORD, createUser } from './helpers/users'

type App = ReturnType<typeof createTestApp>

const expectErrorCode = (res: request.Response, status: number, code: ERROR_CODE) => {
	expect(res.status).toBe(status)
	expect(errorResponseSchema.parse(res.body).error.code).toBe(code)
}

const detailsOf = (res: request.Response) => errorResponseSchema.parse(res.body).error.details

const dayShift = (days: number) => toVersionDate(new Date(Date.now() + days * 86_400_000))

const TODAY = dayShift(0)

/** Logs in a new user (ADMIN member by default) with a new project. */
const setup = async (app: App, { role = ROLE.ADMIN, member = true } = {}) => {
	const { user } = await createUser({ role })
	const project = await getTestPrisma().project.create({
		data: { name: 'A', slug: `a-${randomUUID().slice(0, 8)}`, members: member ? { create: { userId: user.id } } : undefined },
	})
	return { user, project, cookie: await loginAs(app, { email: user.email, password: TEST_PASSWORD }) }
}

type VersionRow = { name?: string; startsAt: string; endsAt: string; lock?: VERSION_LOCK; createdById?: string }

const createVersionRow = (projectId: string, { name = `v${randomUUID().slice(0, 6)}`, startsAt, endsAt, lock, createdById }: VersionRow) =>
	getTestPrisma().projectVersion.create({ data: { projectId, name, startsAt: toDbDate(startsAt), endsAt: toDbDate(endsAt), lock, createdById } })

const versionsUrl = (projectId: string) => `/api/projects/${projectId}/versions`

const post = (app: App, cookie: string, projectId: string, body: CreateProjectVersionRequestInput | Record<string, unknown>) =>
	request(app).post(versionsUrl(projectId)).set('Cookie', cookie).set(CSRF_HEADERS).send(body)

const patch = (app: App, cookie: string, projectId: string, versionId: string, body: UpdateProjectVersionRequestInput | Record<string, unknown>) =>
	request(app)
		.patch(`${versionsUrl(projectId)}/${versionId}`)
		.set('Cookie', cookie)
		.set(CSRF_HEADERS)
		.send(body)

const VALID: CreateProjectVersionRequestInput = { name: 'v2.45', startsAt: '2026-09-08', endsAt: '2026-09-29' }

describe('GET /api/projects/:projectId/versions', () => {
	it('lists only the versions of the project, newest startsAt first, with lock, state and the current one', async () => {
		const app = createTestApp()
		const { project, user, cookie } = await setup(app, { role: ROLE.USER })
		const other = await getTestPrisma().project.create({ data: { name: 'B', slug: `b-${randomUUID().slice(0, 8)}` } })
		await createVersionRow(other.id, { startsAt: TODAY, endsAt: dayShift(5) })
		const past = await createVersionRow(project.id, { name: 'v1', startsAt: dayShift(-30), endsAt: dayShift(-10), createdById: user.id })
		const overlapping = await createVersionRow(project.id, { name: 'v2', startsAt: dayShift(-5), endsAt: dayShift(20) })
		const current = await createVersionRow(project.id, { name: 'v3', startsAt: dayShift(-1), endsAt: dayShift(5), lock: VERSION_LOCK.UNLOCKED })
		const upcoming = await createVersionRow(project.id, { name: 'v4', startsAt: dayShift(10), endsAt: dayShift(40), lock: VERSION_LOCK.LOCKED })

		const res = await request(app).get(versionsUrl(project.id)).set('Cookie', cookie)

		expect(res.status).toBe(200)
		const { items } = projectVersionsResponseSchema.parse(res.body)
		expect(items.map(({ id, name, lock, isLocked, state, isCurrent, createdBy }) => ({ id, name, lock, isLocked, state, isCurrent, createdBy }))).toEqual([
			{ id: upcoming.id, name: 'v4', lock: 'LOCKED', isLocked: true, state: 'LOCKED', isCurrent: false, createdBy: null },
			{ id: current.id, name: 'v3', lock: 'UNLOCKED', isLocked: false, state: 'ACTIVE', isCurrent: true, createdBy: null },
			{ id: overlapping.id, name: 'v2', lock: 'AUTO', isLocked: false, state: 'ACTIVE', isCurrent: false, createdBy: null },
			{ id: past.id, name: 'v1', lock: 'AUTO', isLocked: true, state: 'LOCKED', isCurrent: false, createdBy: { id: user.id, name: user.email } },
		])
		expect(items[3]).toMatchObject({ startsAt: dayShift(-30), endsAt: dayShift(-10) })
	})

	it("returns an empty list for a project without versions and 404 outside the member's projects", async () => {
		const app = createTestApp()
		const { project, cookie } = await setup(app, { role: ROLE.USER })
		expect((await request(app).get(versionsUrl(project.id)).set('Cookie', cookie)).body).toEqual({ items: [] })

		const outsider = await setup(app, { role: ROLE.USER, member: false })
		expectErrorCode(await request(app).get(versionsUrl(project.id)).set('Cookie', outsider.cookie), 404, ERROR_CODE.NOT_FOUND)
		expectErrorCode(await request(app).get(versionsUrl(project.id)), 401, ERROR_CODE.AUTH_UNAUTHENTICATED)
	})
})

describe('POST /api/projects/:projectId/versions', () => {
	it('creates a version with AUTO lock, records VERSION_CREATED and marks it current when today falls into it', async () => {
		const app = createTestApp()
		const { project, user, cookie } = await setup(app)
		const body = { name: ' v2.45 ', startsAt: dayShift(-2), endsAt: dayShift(3) }

		const res = await post(app, cookie, project.id, body)

		expect(res.status).toBe(201)
		const { id, createdAt, ...version } = projectVersionSchema.parse(res.body)
		expect(id).toBe((await getTestPrisma().projectVersion.findFirstOrThrow({ where: { projectId: project.id } })).id)
		expect(Date.parse(createdAt)).not.toBeNaN()
		expect(version).toEqual({
			name: 'v2.45',
			startsAt: body.startsAt,
			endsAt: body.endsAt,
			lock: 'AUTO',
			isLocked: false,
			state: 'ACTIVE',
			isCurrent: true,
			importedAt: null,
			keyCount: 0,
			createdBy: { id: user.id, name: user.email },
		})
		const events = await getTestPrisma().activityEvent.findMany({ where: { projectId: project.id } })
		expect(events.map(({ type, payload, userId }) => ({ type, payload, userId }))).toEqual([
			{ type: ACTIVITY_TYPE.VERSION_CREATED, payload: { name: 'v2.45', startsAt: body.startsAt, endsAt: body.endsAt }, userId: user.id },
		])
	})

	it('rejects endsAt not after startsAt and missing fields with field details', async () => {
		const app = createTestApp()
		const { project, cookie } = await setup(app)

		const same = await post(app, cookie, project.id, { ...VALID, endsAt: VALID.startsAt })
		expectErrorCode(same, 400, ERROR_CODE.VALIDATION_ERROR)
		expect(detailsOf(same)).toEqual([{ path: 'endsAt', code: VALIDATION_CODE.INVALID }])

		const missing = await post(app, cookie, project.id, { name: 'v1' })
		expectErrorCode(missing, 400, ERROR_CODE.VALIDATION_ERROR)
		expect(detailsOf(missing)).toEqual([
			{ path: 'startsAt', code: VALIDATION_CODE.REQUIRED },
			{ path: 'endsAt', code: VALIDATION_CODE.REQUIRED },
		])
		expect(await getTestPrisma().projectVersion.count({ where: { projectId: project.id } })).toBe(0)
	})

	it('returns 409 for a name already used in the project, but allows it in another project', async () => {
		const app = createTestApp()
		const { project, cookie } = await setup(app)
		expect((await post(app, cookie, project.id, VALID)).status).toBe(201)

		expectErrorCode(await post(app, cookie, project.id, VALID), 409, ERROR_CODE.PROJECT_VERSION_NAME_TAKEN)

		const { project: other } = await setup(app)
		expect((await post(app, cookie, other.id, VALID)).status).toBe(201)
	})

	it('is for ADMIN only and needs the CSRF header', async () => {
		const app = createTestApp()
		const editor = await setup(app, { role: ROLE.USER })
		expectErrorCode(await post(app, editor.cookie, editor.project.id, VALID), 403, ERROR_CODE.FORBIDDEN)

		const admin = await setup(app)
		expectErrorCode(await request(app).post(versionsUrl(admin.project.id)).set('Cookie', admin.cookie).send(VALID), 403, ERROR_CODE.CSRF_REJECTED)
	})
})

describe('PATCH /api/projects/:projectId/versions/:versionId', () => {
	it('changes the name, the dates and the lock, records the changed fields and keeps keys pointing at the version', async () => {
		const app = createTestApp()
		const { project, user, cookie } = await setup(app)
		const version = await createVersionRow(project.id, { name: 'v1', startsAt: dayShift(-20), endsAt: dayShift(-10) })
		const key = await getTestPrisma().translationKey.create({ data: { projectId: project.id, namespace: 'loc', name: 'a', versionId: version.id } })

		const res = await patch(app, cookie, project.id, version.id, { name: 'v1.1', endsAt: dayShift(10), lock: 'UNLOCKED' })

		expect(res.status).toBe(200)
		expect(projectVersionSchema.parse(res.body)).toMatchObject({
			id: version.id,
			name: 'v1.1',
			startsAt: dayShift(-20),
			endsAt: dayShift(10),
			lock: 'UNLOCKED',
			isLocked: false,
			state: 'ACTIVE',
			isCurrent: true,
		})
		expect((await getTestPrisma().translationKey.findUniqueOrThrow({ where: { id: key.id } })).versionId).toBe(version.id)
		const events = await getTestPrisma().activityEvent.findMany({ where: { projectId: project.id } })
		expect(events.map(({ type, payload, userId }) => ({ type, payload, userId }))).toEqual([
			{ type: ACTIVITY_TYPE.VERSION_UPDATED, payload: { name: 'v1.1', fields: ['name', 'endsAt', 'lock'] }, userId: user.id },
		])
	})

	it('locks a running version by hand and writes no event when nothing changed', async () => {
		const app = createTestApp()
		const { project, cookie } = await setup(app)
		const version = await createVersionRow(project.id, { startsAt: dayShift(-1), endsAt: dayShift(5) })

		const locked = await patch(app, cookie, project.id, version.id, { lock: 'LOCKED' })
		expect(projectVersionSchema.parse(locked.body)).toMatchObject({ lock: 'LOCKED', isLocked: true, state: 'LOCKED', isCurrent: true })

		const unchanged = await patch(app, cookie, project.id, version.id, { lock: 'LOCKED', name: version.name })
		expect(unchanged.status).toBe(200)
		expect(await getTestPrisma().activityEvent.count({ where: { projectId: project.id } })).toBe(1)
	})

	it('checks the dates against the stored ones, the name against the project and needs at least one field', async () => {
		const app = createTestApp()
		const { project, cookie } = await setup(app)
		const version = await createVersionRow(project.id, { name: 'v1', startsAt: '2026-09-08', endsAt: '2026-09-29' })
		await createVersionRow(project.id, { name: 'v2', startsAt: '2026-10-06', endsAt: '2026-10-27' })

		const tooLate = await patch(app, cookie, project.id, version.id, { startsAt: '2026-09-29' })
		expectErrorCode(tooLate, 400, ERROR_CODE.VALIDATION_ERROR)
		expect(detailsOf(tooLate)).toEqual([{ path: 'endsAt', code: VALIDATION_CODE.INVALID }])
		const tooEarly = await patch(app, cookie, project.id, version.id, { endsAt: '2026-09-01' })
		expectErrorCode(tooEarly, 400, ERROR_CODE.VALIDATION_ERROR)
		expectErrorCode(await patch(app, cookie, project.id, version.id, {}), 400, ERROR_CODE.VALIDATION_ERROR)
		expectErrorCode(await patch(app, cookie, project.id, version.id, { lock: 'AUTO' }), 400, ERROR_CODE.VALIDATION_ERROR)
		expectErrorCode(await patch(app, cookie, project.id, version.id, { name: 'v2' }), 409, ERROR_CODE.PROJECT_VERSION_NAME_TAKEN)

		const stored = await getTestPrisma().projectVersion.findUniqueOrThrow({ where: { id: version.id } })
		expect({ name: stored.name, lock: stored.lock }).toEqual({ name: 'v1', lock: 'AUTO' })
		expect(await getTestPrisma().activityEvent.count({ where: { projectId: project.id } })).toBe(0)
	})

	it('returns 404 for a version of another project or a non-UUID id and 403 for an EDITOR', async () => {
		const app = createTestApp()
		const { project, cookie } = await setup(app)
		const { project: other } = await setup(app)
		const foreign = await createVersionRow(other.id, { startsAt: '2026-09-08', endsAt: '2026-09-29' })

		expectErrorCode(await patch(app, cookie, project.id, foreign.id, { name: 'x' }), 404, ERROR_CODE.PROJECT_VERSION_NOT_FOUND)
		expectErrorCode(await patch(app, cookie, project.id, 'not-a-uuid', { name: 'x' }), 404, ERROR_CODE.PROJECT_VERSION_NOT_FOUND)

		const editor = await setup(app, { role: ROLE.USER })
		const version = await createVersionRow(editor.project.id, { startsAt: '2026-09-08', endsAt: '2026-09-29' })
		expectErrorCode(await patch(app, editor.cookie, editor.project.id, version.id, { lock: 'UNLOCKED' }), 403, ERROR_CODE.FORBIDDEN)
	})
})

describe('findDefaultVersionId', () => {
	it('picks the current version by date, prefers the latest startsAt, falls back to the newest and returns null without one', async () => {
		const prisma = getTestPrisma()
		const project = await prisma.project.create({ data: { name: 'A', slug: `a-${randomUUID().slice(0, 8)}` } })
		expect(await findDefaultVersionId(prisma, project.id, TODAY)).toBeNull()

		const past = await createVersionRow(project.id, { startsAt: dayShift(-30), endsAt: dayShift(-1) })
		expect(await findDefaultVersionId(prisma, project.id, TODAY)).toBe(past.id)
		const upcoming = await createVersionRow(project.id, { startsAt: dayShift(5), endsAt: dayShift(20) })
		expect(await findDefaultVersionId(prisma, project.id, TODAY)).toBe(upcoming.id)
		await createVersionRow(project.id, { startsAt: dayShift(-10), endsAt: dayShift(10) })
		const newer = await createVersionRow(project.id, { startsAt: dayShift(-2), endsAt: dayShift(20) })
		expect(await findDefaultVersionId(prisma, project.id, TODAY)).toBe(newer.id)
	})
})

describe('resolveVersion', () => {
	it('rejects a locked version and one outside its window for an EDITOR, lets an ADMIN through and rejects a foreign version', async () => {
		const prisma = getTestPrisma()
		const project = await prisma.project.create({ data: { name: 'A', slug: `a-${randomUUID().slice(0, 8)}` } })
		const other = await prisma.project.create({ data: { name: 'B', slug: `b-${randomUUID().slice(0, 8)}` } })
		const expired = await createVersionRow(project.id, { startsAt: dayShift(-30), endsAt: dayShift(-1) })
		const upcoming = await createVersionRow(project.id, { startsAt: dayShift(1), endsAt: dayShift(10) })
		const running = await createVersionRow(project.id, { startsAt: dayShift(-1), endsAt: dayShift(10) })
		const reopened = await createVersionRow(project.id, { startsAt: dayShift(-30), endsAt: dayShift(-1), lock: VERSION_LOCK.UNLOCKED })
		const lockedEarly = await createVersionRow(project.id, { startsAt: dayShift(-1), endsAt: dayShift(10), lock: VERSION_LOCK.LOCKED })
		const foreign = await createVersionRow(other.id, { startsAt: dayShift(-1), endsAt: dayShift(10) })

		const asEditor = (versionId: string) => resolveVersion(prisma, { projectId: project.id, versionId, role: PROJECT_ROLE.EDITOR })
		await expect(asEditor(expired.id)).rejects.toMatchObject({ status: 409, code: ERROR_CODE.PROJECT_VERSION_LOCKED })
		await expect(asEditor(upcoming.id)).rejects.toMatchObject({ status: 409, code: ERROR_CODE.PROJECT_VERSION_LOCKED })
		await expect(asEditor(lockedEarly.id)).rejects.toMatchObject({ status: 409, code: ERROR_CODE.PROJECT_VERSION_LOCKED })
		expect((await asEditor(running.id)).id).toBe(running.id)
		expect((await asEditor(reopened.id)).id).toBe(reopened.id)
		await expect(asEditor(foreign.id)).rejects.toMatchObject({ status: 404, code: ERROR_CODE.PROJECT_VERSION_NOT_FOUND })

		const asAdmin = (versionId: string) => resolveVersion(prisma, { projectId: project.id, versionId, role: ROLE.ADMIN })
		expect(await asAdmin(expired.id)).toEqual({ id: expired.id, name: expired.name, importedAt: null })
		expect((await asAdmin(lockedEarly.id)).id).toBe(lockedEarly.id)
		await expect(asAdmin(foreign.id)).rejects.toMatchObject({ status: 404, code: ERROR_CODE.PROJECT_VERSION_NOT_FOUND })
	})
})
