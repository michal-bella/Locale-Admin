import { z } from 'zod'

/** Emails are stored and compared normalized (trimmed, lower case), so login and create are case-insensitive. */
export const emailSchema = z.string().trim().min(1).toLowerCase().pipe(z.email())

export const normalizeEmail = (email: string) => email.trim().toLowerCase()
