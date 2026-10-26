import { z } from 'zod'

import { ERROR_CODE } from '@locale/shared'

/** `?error=AUTH_USER_BLOCKED`: the backend sends a failed Google sign-in back to the login page with the error code. */
export const loginSearchSchema = z.object({
	error: z.enum(ERROR_CODE).optional().catch(undefined),
})
