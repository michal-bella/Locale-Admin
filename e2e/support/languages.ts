import { type APIRequest, type APIRequestContext, expect } from '@playwright/test'
import pg from 'pg'

import { MUTATION_HEADERS } from './api'
import { STORAGE_STATE } from './auth'
import { BASE_URL, getDatabaseUrl } from './env'

export type Language = { id: string; tag: string; englishName: string; nativeName: string; flagCode: string; isBase: boolean; createdAt: string }

export const LANGUAGES_API = '/api/admin/languages'

/**
 * Catalog tags the suite adds and deletes. Each browser project and the API smoke test use their own tag,
 * so parallel runs never touch the same row.
 */
export const TEST_LANGUAGE = {
	chromium: { tag: 'ru', englishName: 'Russian', nativeName: 'русский', flagCode: 'ru' },
	webkit: { tag: 'hu', englishName: 'Hungarian', nativeName: 'magyar', flagCode: 'hu' },
	apiSmoke: { tag: 'ro', englishName: 'Romanian', nativeName: 'română', flagCode: 'ro' },
} as const

export const newAdminApi = (request: APIRequest) => request.newContext({ baseURL: BASE_URL, storageState: STORAGE_STATE.ADMIN })

export const listLanguages = async (api: APIRequestContext) => {
	const response = await api.get(LANGUAGES_API)
	expect(response.status(), `GET ${LANGUAGES_API}`).toBe(200)
	return (await response.json()) as Language[]
}

export const setBaseLanguage = async (api: APIRequestContext, { id, englishName, nativeName, flagCode }: Language) => {
	const response = await api.patch(`${LANGUAGES_API}/${id}`, { data: { englishName, nativeName, flagCode, isBase: true }, headers: MUTATION_HEADERS })
	expect(response.status(), `PATCH ${LANGUAGES_API}/${id}`).toBe(200)
}

/**
 * Deletes the language with `tag` if it exists. When a failed run left it as the base language,
 * `fallbackBaseTag` (or any other language) becomes the base first, because the base cannot be deleted.
 */
export const deleteLanguageIfPresent = async (api: APIRequestContext, tag: string, fallbackBaseTag = 'sk') => {
	const languages = await listLanguages(api)
	const language = languages.find((item) => item.tag === tag)
	if (!language) {
		return
	}
	if (language.isBase) {
		const others = languages.filter((item) => item.tag !== tag)
		const fallback = others.find((item) => item.tag === fallbackBaseTag) ?? others[0]
		expect(fallback, `another language to become base instead of ${tag}`).toBeDefined()
		await setBaseLanguage(api, fallback!)
	}
	const response = await api.delete(`${LANGUAGES_API}/${language.id}`, { data: {}, headers: MUTATION_HEADERS })
	expect(response.status(), `DELETE ${LANGUAGES_API}/${language.id}`).toBe(204)
}

/**
 * Deletes every suite language left over by an interrupted run (e.g. the stack restarted before `afterAll`),
 * including one left as the base language. Call it only while holding `acquireLanguagesLock()`.
 */
export const deleteLeftoverTestLanguages = async (api: APIRequestContext) => {
	for (const { tag } of Object.values(TEST_LANGUAGE)) {
		await deleteLanguageIfPresent(api, tag)
	}
}

/** Restores `base` as the base language if another one took its place. */
export const restoreBaseLanguage = async (api: APIRequestContext, base: Language) => {
	const current = (await listLanguages(api)).find((item) => item.id === base.id)
	if (current && !current.isBase) {
		await setBaseLanguage(api, current)
	}
}

// Advisory lock key shared by every test that changes the base language or relies on it staying put.
const LANGUAGES_LOCK_KEY = 4_517_001

/**
 * Serializes base-language changes across browser projects and workers: chromium and webkit would otherwise
 * move the single base flag under each other. The lock lives as long as the connection; call `release` in `afterAll`.
 */
export const acquireLanguagesLock = async () => {
	const client = new pg.Client({ connectionString: getDatabaseUrl() })
	await client.connect()
	await client.query('SELECT pg_advisory_lock($1)', [LANGUAGES_LOCK_KEY])
	return async () => {
		try {
			await client.query('SELECT pg_advisory_unlock($1)', [LANGUAGES_LOCK_KEY])
		} finally {
			await client.end()
		}
	}
}
