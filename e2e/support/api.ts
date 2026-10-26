type ApiErrorBody = { error: { code: string; message: string; details?: unknown } }

export const readApiError = async (response: { json: () => Promise<unknown> }) => ((await response.json()) as ApiErrorBody).error

/** Headers every mutation needs to pass the CSRF check. */
export const MUTATION_HEADERS = { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' } as const

export type Role = 'ADMIN' | 'USER'

/** Role of a member in one project (`ProjectMember.role`). */
export type ProjectRole = 'MANAGER' | 'EDITOR' | 'VISITOR'

export type AdminUser = {
	id: string
	email: string
	role: Role
	isActive: boolean
	hasPassword: boolean
	hasGoogle: boolean
	projectCount: number
	lastLoginAt: string | null
	createdAt: string
}
