import { type ERROR_CODE, type ValidationIssue } from '@locale/shared'

export class AppError extends Error {
	constructor(
		readonly status: number,
		readonly code: ERROR_CODE,
		message: string,
		readonly details?: ValidationIssue[],
	) {
		super(message)
		this.name = 'AppError'
	}
}
