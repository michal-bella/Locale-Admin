import { formatEnvError, seedEnvSchema } from '../src/config/env'
import { createPrismaClient } from '../src/lib/prisma'
import { SEED_ADMIN_EMAIL, SEED_LANGUAGE_TAGS, SEED_PROJECT, SEED_TRANSLATIONS, seedAdmin, seedProject, seedTranslations } from '../src/services/seed.service'

const env = seedEnvSchema.safeParse(process.env)
if (!env.success) {
	console.error(`Seed failed. ${formatEnvError(env.error)}`)
	process.exit(1)
}

const prisma = createPrismaClient(env.data.DATABASE_URL)
try {
	const result = await seedAdmin(prisma, env.data.SEED_ADMIN_PASSWORD)
	console.info(result === 'created' ? `Seed: admin ${SEED_ADMIN_EMAIL} created` : `Seed: admin ${SEED_ADMIN_EMAIL} already exists, nothing changed`)
	const project = await seedProject(prisma)
	console.info(
		project === 'created'
			? `Seed: project ${SEED_PROJECT.slug} with languages ${SEED_LANGUAGE_TAGS.join(', ')} created`
			: 'Seed: project already exists, nothing changed',
	)
	const translations = await seedTranslations(prisma)
	console.info(
		{
			created: `Seed: ${SEED_TRANSLATIONS.length} translation keys in ${SEED_PROJECT.slug} created`,
			exists: `Seed: ${SEED_PROJECT.slug} already has translation keys, nothing changed`,
			'no-project': `Seed: project ${SEED_PROJECT.slug} not found, no translation keys created`,
		}[translations],
	)
} catch (error) {
	console.error('Seed failed.', error)
	process.exitCode = 1
} finally {
	await prisma.$disconnect()
}
