import { type LanguageTag } from '@locale/shared'

import { ROLE } from '../generated/prisma/enums'
import { hashPassword } from '../lib/password'
import { type PrismaClient } from '../lib/prisma'

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

/**
 * Seeds only an empty table, so changes stay after a restart. Run after `seedAdmin`: the admin becomes the only member. Languages `sk` (base) and `en`.
 * The sample translations are created only together with the project, so a real project with the same slug never gets invented keys.
 */
export const seedProject = async (prisma: PrismaClient): Promise<SeedProjectResult> => {
	if ((await prisma.project.count()) > 0) {
		return 'exists'
	}
	await prisma.$transaction(async (tx) => {
		const project = await tx.project.create({
			data: {
				...SEED_PROJECT,
				members: { create: { user: { connect: { email: SEED_ADMIN_EMAIL } } } },
				languages: { create: SEED_LANGUAGE_TAGS.map((tag) => ({ tag, isBase: tag === SEED_BASE_LANGUAGE_TAG })) },
			},
			select: { id: true, languages: { select: { id: true, tag: true } } },
		})
		const languageIds = new Map(project.languages.map(({ id, tag }) => [tag, id]))
		for (const { namespace, name, values } of SEED_TRANSLATIONS) {
			await tx.translationKey.create({
				data: {
					projectId: project.id,
					namespace,
					name,
					translations: {
						create: Object.entries(values).flatMap(([tag, value]) => {
							const languageId = languageIds.get(tag)
							return languageId ? [{ languageId, value }] : []
						}),
					},
				},
			})
		}
	})
	return 'created'
}
