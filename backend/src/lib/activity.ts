import { activityEventDataSchema, type ActivityEventData } from '@locale/shared'

import { type Prisma } from '../generated/prisma/client'

export type RecordActivityInput = ActivityEventData & { projectId: string; userId: string | null; count?: number; versionId?: string | null }

/** Appends one `ActivityEvent` inside the caller's transaction, so it is rolled back together with the change. `versionId` ties it to a version. */
export const recordActivity = async (tx: Prisma.TransactionClient, { projectId, userId, count, versionId, ...data }: RecordActivityInput): Promise<void> => {
	const { type, payload } = activityEventDataSchema.parse(data)
	await tx.activityEvent.create({ data: { projectId, userId, versionId, type, payload, count } })
}
