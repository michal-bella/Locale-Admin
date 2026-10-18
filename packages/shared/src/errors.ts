import { z } from 'zod'

export enum ERROR_CODE {
	VALIDATION_ERROR = 'VALIDATION_ERROR',
	AUTH_INVALID_CREDENTIALS = 'AUTH_INVALID_CREDENTIALS',
	AUTH_UNAUTHENTICATED = 'AUTH_UNAUTHENTICATED',
	FORBIDDEN = 'FORBIDDEN',
	CSRF_REJECTED = 'CSRF_REJECTED',
	NOT_FOUND = 'NOT_FOUND',
	EMAIL_TAKEN = 'EMAIL_TAKEN',
	LANGUAGE_TAKEN = 'LANGUAGE_TAKEN',
	LANGUAGE_IS_BASE = 'LANGUAGE_IS_BASE',
	SLUG_TAKEN = 'SLUG_TAKEN',
	LAST_MEMBER = 'LAST_MEMBER',
	RATE_LIMITED = 'RATE_LIMITED',
	INTERNAL_ERROR = 'INTERNAL_ERROR',
}

/** Own validation codes so that FE translations do not depend on zod internals (they changed between zod 3 and 4). */
export enum VALIDATION_CODE {
	REQUIRED = 'REQUIRED',
	INVALID_EMAIL = 'INVALID_EMAIL',
	TOO_SHORT = 'TOO_SHORT',
	TOO_LONG = 'TOO_LONG',
	INVALID = 'INVALID',
}

export const validationIssueSchema = z.object({
	path: z.string(),
	code: z.enum(VALIDATION_CODE),
	params: z.object({ min: z.number().optional(), max: z.number().optional() }).optional(),
})

export type ValidationIssue = z.infer<typeof validationIssueSchema>

export const errorResponseSchema = z.object({
	error: z.object({
		code: z.enum(ERROR_CODE),
		message: z.string(),
		details: z.array(validationIssueSchema).optional(),
	}),
})

export type ErrorResponse = z.infer<typeof errorResponseSchema>

/** Maps one zod issue to a shared validation code. The only place that knows zod issue shapes. */
export const toValidationCode = (issue: z.core.$ZodIssue): Pick<ValidationIssue, 'code' | 'params'> => {
	switch (issue.code) {
		case 'invalid_type':
			return { code: issue.input === undefined || issue.input === null ? VALIDATION_CODE.REQUIRED : VALIDATION_CODE.INVALID }
		case 'too_small':
			if (Number(issue.minimum) <= 1) {
				return { code: VALIDATION_CODE.REQUIRED }
			}
			return { code: VALIDATION_CODE.TOO_SHORT, params: { min: Number(issue.minimum) } }
		case 'too_big':
			return { code: VALIDATION_CODE.TOO_LONG, params: { max: Number(issue.maximum) } }
		case 'invalid_format':
			return { code: issue.format === 'email' ? VALIDATION_CODE.INVALID_EMAIL : VALIDATION_CODE.INVALID }
		default:
			return { code: VALIDATION_CODE.INVALID }
	}
}

export const toValidationIssues = (error: z.ZodError): ValidationIssue[] =>
	error.issues.map((issue) => ({ path: issue.path.map(String).join('.'), ...toValidationCode(issue) }))
