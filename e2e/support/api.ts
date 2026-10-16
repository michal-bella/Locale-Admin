type ApiErrorBody = { error: { code: string; message: string; details?: unknown } }

export const readApiError = async (response: { json: () => Promise<unknown> }) => ((await response.json()) as ApiErrorBody).error

/** Headers every mutation needs to pass the CSRF check. */
export const MUTATION_HEADERS = { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' } as const

export type AdminUser = { id: string; email: string; role: 'ADMIN' | 'EDITOR'; createdAt: string }
