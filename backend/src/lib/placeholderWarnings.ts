import { comparePlaceholders, placeholders } from '@locale/shared'

import { type Prisma } from '../generated/prisma/client'

import { type PrismaClient } from './prisma'

type Db = PrismaClient | Prisma.TransactionClient

/** Keys per round trip; an import can touch thousands and the project-wide recompute all of them. */
const KEY_BATCH_SIZE = 2000

type KeyRow = {
	id: string
	name: string
	translations: { languageId: string; value: string | null; placeholderWarning: boolean | null; language: { isBase: boolean } }[]
}

/** Same reference as the edit and export checks: the base value, or the key name when the base is empty and the name has placeholders. */
const referenceOf = (key: KeyRow): string | null => {
	const base = key.translations.find((row) => row.language.isBase)?.value ?? null
	return base ?? (placeholders(key.name).size > 0 ? key.name : null)
}

const hasWarning = (reference: string | null, row: KeyRow['translations'][number]): boolean => {
	if (row.language.isBase || row.value === null || reference === null) {
		return false
	}
	const { missing, extra } = comparePlaceholders(reference, row.value)
	return missing.length > 0 || extra.length > 0
}

const recomputeBatch = async (db: Db, keyIds: string[]) => {
	const keys = await db.translationKey.findMany({
		where: { id: { in: keyIds } },
		select: {
			id: true,
			name: true,
			translations: { select: { languageId: true, value: true, placeholderWarning: true, language: { select: { isBase: true } } } },
		},
	})
	const changed: { keyId: string; languageId: string; warning: boolean }[] = []
	for (const key of keys) {
		const reference = referenceOf(key)
		for (const row of key.translations) {
			const warning = hasWarning(reference, row)
			if (row.placeholderWarning !== warning) {
				changed.push({ keyId: key.id, languageId: row.languageId, warning })
			}
		}
	}
	if (changed.length === 0) {
		return
	}
	// Only the flag changes: `updatedAt` and `updatedById` keep saying who last changed the value.
	await db.$executeRaw`
		UPDATE "Translation" t SET "placeholderWarning" = f.warning
		FROM unnest(${changed.map((row) => row.keyId)}::uuid[], ${changed.map((row) => row.languageId)}::uuid[], ${changed.map((row) => row.warning)}::boolean[])
			AS f("keyId", "languageId", warning)
		WHERE t."keyId" = f."keyId" AND t."languageId" = f."languageId"`
}

/**
 * Sets `Translation.placeholderWarning` for every cell of the keys: `true` when the value's placeholders differ from the reference,
 * `false` otherwise (always for the base language). Call it in the transaction of every write that can change a value, a key
 * name or the base language, so the flag the list filters by is never stale.
 */
export const recomputePlaceholderWarnings = async (db: Db, keyIds: string[]): Promise<void> => {
	const ids = [...new Set(keyIds)]
	for (let index = 0; index < ids.length; index += KEY_BATCH_SIZE) {
		await recomputeBatch(db, ids.slice(index, index + KEY_BATCH_SIZE))
	}
}

/** Every key of the project, e.g. after the base language changed. */
export const recomputeProjectPlaceholderWarnings = async (db: Db, projectId: string): Promise<void> => {
	const keys = await db.translationKey.findMany({ where: { projectId }, select: { id: true } })
	await recomputePlaceholderWarnings(
		db,
		keys.map(({ id }) => id),
	)
}

/**
 * Fills the flag of rows the services have not computed yet (`null`: rows from before the column existed, or inserted outside the
 * services). Idempotent, runs with the seed on every start; returns the number of keys it touched.
 */
export const seedPlaceholderWarnings = async (prisma: PrismaClient): Promise<number> => {
	let total = 0
	for (;;) {
		const pending = await prisma.translation.findMany({
			where: { placeholderWarning: null },
			distinct: ['keyId'],
			select: { keyId: true },
			take: KEY_BATCH_SIZE,
		})
		if (pending.length === 0) {
			return total
		}
		const keyIds = pending.map(({ keyId }) => keyId)
		await prisma.$transaction(async (tx) => {
			await recomputePlaceholderWarnings(tx, keyIds)
			// A base-language row stays null when its value is fine and nothing else changed it; settle it so the loop ends.
			await tx.translation.updateMany({ where: { keyId: { in: keyIds }, placeholderWarning: null }, data: { placeholderWarning: false } })
		})
		total += keyIds.length
	}
}
