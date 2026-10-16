type ApiErrorBody = { error: { code: string; message: string } }

export const readApiError = async (response: { json: () => Promise<unknown> }) => ((await response.json()) as ApiErrorBody).error
