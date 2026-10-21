import { z } from 'zod'

import { projectSlugSchema } from '@locale/shared'

/** `?from=b2b-admin` on the admin pages: the project they were opened from, so the sidebar links back to it instead of to Všetky projekty. */
export const adminSearchSchema = z.object({
	from: projectSlugSchema.optional().catch(undefined),
})
