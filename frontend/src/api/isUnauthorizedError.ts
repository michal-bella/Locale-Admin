import { type AxiosError, isAxiosError } from 'axios'

export const isUnauthorizedError = (error: unknown): error is AxiosError => isAxiosError(error) && error.response?.status === 401
