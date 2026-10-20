import { activityEventDataSchema, type ActivityEventData } from '@locale/shared'

import { type Prisma } from '../generated/prisma/client'

export type RecordActivityInput = ActivityEventData & { projectId: string; userId: string | null; count?: number }

/** Appends one `ActivityEvent` inside the caller's transaction, so it is rolled back together with the change. */
export const recordActivity = async (tx: Prisma.TransactionClient, { projectId, userId, count, ...data }: RecordActivityInput): Promise<void> => {
	const { type, payload } = activityEventDataSchema.parse(data)
	await tx.activityEvent.create({ data: { projectId, userId, type, payload, count } })
}
