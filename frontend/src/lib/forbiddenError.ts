/** Thrown by a route guard when the signed-in user lacks the role; the route renders the 403 page and keeps the URL. */
export class ForbiddenError extends Error {
	constructor() {
		super('Forbidden')
		this.name = 'ForbiddenError'
	}
}
