import { formatEnvError, seedEnvSchema } from '../src/config/env'
import { createPrismaClient } from '../src/lib/prisma'
import { SEED_ADMIN_EMAIL, SEED_LANGUAGE_TAGS, seedAdmin, seedLanguages } from '../src/services/seed.service'

const env = seedEnvSchema.safeParse(process.env)
if (!env.success) {
	console.error(`Seed failed. ${formatEnvError(env.error)}`)
	process.exit(1)
}

const prisma = createPrismaClient(env.data.DATABASE_URL)
try {
	const result = await seedAdmin(prisma, env.data.SEED_ADMIN_PASSWORD)
	console.info(result === 'created' ? `Seed: admin ${SEED_ADMIN_EMAIL} created` : `Seed: admin ${SEED_ADMIN_EMAIL} already exists, nothing changed`)
	await seedLanguages(prisma)
	console.info(`Seed: languages ${SEED_LANGUAGE_TAGS.join(', ')} ensured`)
} catch (error) {
	console.error('Seed failed.', error)
	process.exitCode = 1
} finally {
	await prisma.$disconnect()
}
