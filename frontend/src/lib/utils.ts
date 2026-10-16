import { LANGUAGE } from '@/lib/enum'

export const isLanguage = (value: unknown): value is LANGUAGE => Object.values<unknown>(LANGUAGE).includes(value)
