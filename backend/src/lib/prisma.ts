import { PrismaPg } from '@prisma/adapter-pg'

import { PrismaClient } from '../generated/prisma/client'

export const createPrismaClient = (databaseUrl: string): PrismaClient => new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) })

export { type PrismaClient }
