import { formatEnvError, seedEnvSchema } from '../src/config/env'
import { seedPlaceholderWarnings } from '../src/lib/placeholderWarnings'
import { createPrismaClient } from '../src/lib/prisma'
import { SEED_ADMIN_EMAIL, SEED_LANGUAGE_TAGS, SEED_PROJECT, SEED_TRANSLATIONS, seedAdmin, seedProject } from '../src/services/seed.service'

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
			? `Seed: project ${SEED_PROJECT.slug} with languages ${SEED_LANGUAGE_TAGS.join(', ')} and ${SEED_TRANSLATIONS.length} translation keys created`
			: 'Seed: project already exists, nothing changed',
	)
	const recomputed = await seedPlaceholderWarnings(prisma)
	console.info(recomputed > 0 ? `Seed: placeholder warnings computed for ${recomputed} translation keys` : 'Seed: placeholder warnings up to date')
} catch (error) {
	console.error('Seed failed.', error)
	process.exitCode = 1
} finally {
	await prisma.$disconnect()
}
