import { type ERROR_CODE, type ErrorResponse } from '@locale/shared'

export class AppError extends Error {
	constructor(
		readonly status: number,
		readonly code: ERROR_CODE,
		message: string,
		readonly details?: ErrorResponse['error']['details'],
	) {
		super(message)
		this.name = 'AppError'
	}
}
