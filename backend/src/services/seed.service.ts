import { ACTIVITY_TYPE, activityEventDataSchema, type ActivityEventData, type LanguageTag, toVersionDate } from '@locale/shared'

import { ROLE } from '../generated/prisma/enums'
import { hashPassword } from '../lib/password'
import { type PrismaClient } from '../lib/prisma'
import { toDbDate } from '../lib/projectVersions'

export const SEED_ADMIN_EMAIL = 'michal.bella@goodrequest.com'

export type SeedAdminResult = 'created' | 'exists'

/** Creates the admin if missing. An existing admin is never changed (not even the password or role). */
export const seedAdmin = async (prisma: PrismaClient, password: string): Promise<SeedAdminResult> => {
	const existing = await prisma.user.findUnique({ where: { email: SEED_ADMIN_EMAIL }, select: { id: true } })
	if (existing) {
		return 'exists'
	}
	await prisma.user.create({ data: { email: SEED_ADMIN_EMAIL, passwordHash: await hashPassword(password), role: ROLE.ADMIN } })
	return 'created'
}

const SEED_BASE_LANGUAGE_TAG = 'sk' satisfies LanguageTag

export const SEED_LANGUAGE_TAGS = [SEED_BASE_LANGUAGE_TAG, 'en'] as const satisfies LanguageTag[]

export const SEED_PROJECT = { name: 'B2B Admin', slug: 'b2b-admin' } as const

export type SeedProjectResult = 'created' | 'exists'

type SeedTranslation = { namespace: string; name: string; values: Partial<Record<(typeof SEED_LANGUAGE_TAGS)[number], string | null>> }

/** Invented sample data. A tag missing from `values` has no row, `null` is a row without a value: both are untranslated. */
export const SEED_TRANSLATIONS: SeedTranslation[] = [
	{ namespace: 'loc', name: 'Uložiť', values: { sk: 'Uložiť', en: 'Save' } },
	{ namespace: 'loc', name: 'Zrušiť', values: { sk: 'Zrušiť', en: 'Cancel' } },
	{ namespace: 'loc', name: 'Odstrániť', values: { sk: 'Odstrániť', en: 'Delete' } },
	{ namespace: 'loc', name: 'Hľadať', values: { sk: 'Hľadať', en: 'Search' } },
	{ namespace: 'loc', name: 'Načítavam…', values: { sk: 'Načítavam…', en: null } },
	{ namespace: 'loc', name: 'Zmeny boli uložené.', values: { sk: 'Zmeny boli uložené.', en: 'Changes have been saved.' } },
	{
		namespace: 'loc',
		name: 'Niečo sa pokazilo. Skúste to znova.',
		values: { sk: 'Niečo sa pokazilo. Skúste to znova.', en: 'Something went wrong. Please try again.' },
	},
	{ namespace: 'loc', name: 'Adresa doručenia nie je kompletná. Doplňte ju', values: { sk: 'Adresa doručenia nie je kompletná. Doplňte ju' } },
	{ namespace: 'loc', name: 'Počet položiek: {{count}}', values: { sk: 'Počet položiek: {{count}}', en: 'Items: {{count}}' } },
	{ namespace: 'loc', name: 'Vitajte späť, {{ name }}!', values: { sk: 'Vitajte späť, {{ name }}!', en: null } },
	{
		namespace: 'loc',
		name: 'Objednávka {{number}} bola odoslaná',
		values: { sk: 'Objednávka <strong>{{number}}</strong> bola odoslaná', en: 'Order <strong>{{number}}</strong> has been shipped' },
	},
	{ namespace: 'loc', name: 'Platnosť odkazu vypršala', values: { sk: 'Platnosť odkazu vypršala' } },
	{ namespace: 'loc', name: 'orders.empty.title', values: { sk: 'Zatiaľ nemáte žiadne objednávky', en: 'You have no orders yet' } },
	{ namespace: 'loc', name: 'orders.empty.description', values: { sk: 'Prvá objednávka sa tu zobrazí hneď po jej vytvorení.', en: null } },
	{ namespace: 'loc', name: 'orders.list.title', values: { sk: 'Objednávky', en: 'Orders' } },
	{ namespace: 'loc', name: 'orders.list.total', values: { sk: 'Spolu {{count}} objednávok', en: 'Total of {{count}} orders' } },
	{ namespace: 'loc', name: 'orders.detail.status', values: { sk: 'Stav objednávky', en: 'Order status' } },
	{ namespace: 'loc', name: 'orders.detail.cancel', values: { sk: 'Stornovať objednávku' } },
	{ namespace: 'loc', name: 'invoices.download', values: { sk: 'Stiahnuť faktúru', en: 'Download invoice' } },
	{ namespace: 'loc', name: 'invoices.overdue', values: { sk: 'Faktúra je {{days}} dní po splatnosti', en: null } },
	{ namespace: 'loc', name: 'profile.form.firstName', values: { sk: 'Meno', en: 'First name' } },
	{ namespace: 'loc', name: 'profile.form.lastName', values: { sk: 'Priezvisko', en: 'Last name' } },
	{ namespace: 'paths', name: 'orders', values: { sk: '/objednavky', en: '/orders' } },
	{ namespace: 'paths', name: 'orders.detail', values: { sk: '/objednavky/:id', en: '/orders/:id' } },
	{ namespace: 'paths', name: 'invoices', values: { sk: '/faktury', en: '/invoices' } },
	{ namespace: 'paths', name: 'invoices.detail', values: { sk: '/faktury/:id' } },
	{ namespace: 'paths', name: 'profile', values: { sk: '/profil', en: '/profile' } },
	{ namespace: 'paths', name: 'profile.security', values: { sk: '/profil/zabezpecenie', en: null } },
	{ namespace: 'paths', name: 'help', values: { sk: '/pomoc', en: '/help' } },
	{ namespace: 'paths', name: 'help.contact', values: { sk: '/pomoc/kontakt' } },
]

const DAY_MS = 24 * 60 * 60 * 1000

const dayShift = (days: number) => toVersionDate(new Date(Date.now() + days * DAY_MS))

/**
 * Two versions, each with its own copy of the keys: the previous one (locked, its window is over) holds the first
 * `SEED_PREVIOUS_KEY_COUNT` keys with one English value still missing, the current one every key, so the diff shows added and changed keys.
 */
export const SEED_VERSIONS = {
	previous: { name: 'v2.44', startsAt: dayShift(-40), endsAt: dayShift(-12) },
	current: { name: 'v2.45', startsAt: dayShift(-11), endsAt: dayShift(17) },
} as const

export const SEED_PREVIOUS_KEY_COUNT = 26

/** Key whose English value the previous version still misses (translated only in the current one). */
export const SEED_PREVIOUS_UNTRANSLATED_KEY = 'orders.list.title'

type SeedKey = { id: string; namespace: string; name: string; en: string | null | undefined }

type SeedActivityEvent = { daysAgo: number; count?: number; data: ActivityEventData }

/** Invented history of the last 30 days (0 = today): the project, its first import, then edits by the admin. Some days stay empty for the dashboard chart. */
const seedActivityEvents = (keys: SeedKey[]): SeedActivityEvent[] => {
	const translated = keys.filter((key): key is SeedKey & { en: string } => typeof key.en === 'string')
	const filled = SEED_TRANSLATIONS.flatMap(({ values }) => Object.values(values)).filter((value) => value !== null).length
	const { id: keyId, namespace, name } = translated[0] as SeedKey
	return [
		{ daysAgo: 30, data: { type: ACTIVITY_TYPE.PROJECT_CREATED, payload: { name: SEED_PROJECT.name } } },
		{
			daysAgo: 29,
			count: filled,
			data: {
				type: ACTIVITY_TYPE.KEYS_IMPORTED,
				payload: { keysCreated: keys.length, translationsCreated: filled, translationsUpdated: 0, languageTags: [...SEED_LANGUAGE_TAGS] },
			},
		},
		{ daysAgo: 22, data: { type: ACTIVITY_TYPE.PROJECT_UPDATED, payload: { fields: ['primaryColor'] } } },
		{ daysAgo: 12, data: { type: ACTIVITY_TYPE.KEY_UPDATED, payload: { keyId, namespace, name, fields: ['description'] } } },
		...[26, 21, 17, 9, 8, 5, 3, 3, 3, 3, 2, 0].map((daysAgo, index): SeedActivityEvent => {
			const key = translated[index % translated.length] as SeedKey & { en: string }
			return {
				daysAgo,
				data: {
					type: ACTIVITY_TYPE.TRANSLATION_UPDATED,
					payload: { keyId: key.id, namespace: key.namespace, name: key.name, languageTag: 'en', oldValue: null, newValue: key.en },
				},
			}
		}),
	]
}

/**
 * Seeds only an empty table, so changes stay after a restart. Run after `seedAdmin`: the admin becomes the only member. Languages `sk` (base) and `en`.
 * The sample translations (in both versions of `SEED_VERSIONS`) and activity are created only together with the project, so a real project
 * with the same slug never gets invented data.
 */
export const seedProject = async (prisma: PrismaClient): Promise<SeedProjectResult> => {
	if ((await prisma.project.count()) > 0) {
		return 'exists'
	}
	await prisma.$transaction(async (tx) => {
		const now = Date.now()
		const admin = await tx.user.findUniqueOrThrow({ where: { email: SEED_ADMIN_EMAIL }, select: { id: true } })
		const project = await tx.project.create({
			data: {
				...SEED_PROJECT,
				createdAt: new Date(now - 30 * DAY_MS - 60 * 1000),
				members: { create: { user: { connect: { email: SEED_ADMIN_EMAIL } } } },
				languages: { create: SEED_LANGUAGE_TAGS.map((tag, position) => ({ tag, isBase: tag === SEED_BASE_LANGUAGE_TAG, position })) },
			},
			select: { id: true, languages: { select: { id: true, tag: true } } },
		})
		const languageIds = new Map(project.languages.map(({ id, tag }) => [tag, id]))
		const versionData = ({ name, startsAt, endsAt }: (typeof SEED_VERSIONS)[keyof typeof SEED_VERSIONS], importedDaysAgo: number) => ({
			projectId: project.id,
			name,
			startsAt: toDbDate(startsAt),
			endsAt: toDbDate(endsAt),
			createdById: admin.id,
			createdAt: new Date(now - importedDaysAgo * DAY_MS - 30 * 60 * 1000),
			importedAt: new Date(now - importedDaysAgo * DAY_MS),
		})
		const previous = await tx.projectVersion.create({ data: versionData(SEED_VERSIONS.previous, 29), select: { id: true } })
		const current = await tx.projectVersion.create({ data: versionData(SEED_VERSIONS.current, 10), select: { id: true } })
		const createKey = async (versionId: string, { namespace, name, values }: SeedTranslation) =>
			tx.translationKey.create({
				data: {
					projectId: project.id,
					versionId,
					namespace,
					name,
					translations: {
						create: Object.entries(values).flatMap(([tag, value]) => {
							const languageId = languageIds.get(tag)
							return languageId ? [{ languageId, value }] : []
						}),
					},
				},
				select: { id: true },
			})
		for (const translation of SEED_TRANSLATIONS.slice(0, SEED_PREVIOUS_KEY_COUNT)) {
			const values = translation.name === SEED_PREVIOUS_UNTRANSLATED_KEY ? { ...translation.values, en: null } : translation.values
			await createKey(previous.id, { ...translation, values })
		}
		const keys: SeedKey[] = []
		for (const translation of SEED_TRANSLATIONS) {
			const { id } = await createKey(current.id, translation)
			keys.push({ id, namespace: translation.namespace, name: translation.name, en: translation.values.en })
		}
		await tx.activityEvent.createMany({
			data: seedActivityEvents(keys).map(({ daysAgo, count, data }, index) => ({
				projectId: project.id,
				userId: admin.id,
				...activityEventDataSchema.parse(data),
				count,
				createdAt: new Date(now - daysAgo * DAY_MS - index * 60 * 1000),
			})),
		})
	})
	return 'created'
}
