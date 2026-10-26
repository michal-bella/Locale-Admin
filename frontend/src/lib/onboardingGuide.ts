import { DEFAULT_LANGUAGE } from '@/lib/constants'
import { isLanguage } from '@/lib/utils'

/** Path of the editor onboarding PDF in the given UI language; the files live in `public/guides/`. */
export const onboardingGuidePath = (language: string) => `/guides/onboarding-editor-${isLanguage(language) ? language : DEFAULT_LANGUAGE}.pdf`
