import { z } from 'zod'

/** A `ProjectVersion` as keys, the import result and the list refer to it. A leaf module, so imports and translations can both use it. */
export const translationVersionRefSchema = z.object({
	id: z.uuid(),
	name: z.string(),
})

export type TranslationVersionRef = z.infer<typeof translationVersionRefSchema>
