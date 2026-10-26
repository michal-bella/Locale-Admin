import { describe, expect, it } from 'vite-plus/test'

import { onboardingGuidePath } from '@/lib/onboardingGuide'

describe('onboardingGuidePath', () => {
	it.each([
		['sk', '/guides/onboarding-editor-sk.pdf'],
		['en', '/guides/onboarding-editor-en.pdf'],
		['cs', '/guides/onboarding-editor-cs.pdf'],
		['de', '/guides/onboarding-editor-sk.pdf'],
	])('%s → %s', (language, path) => {
		expect(onboardingGuidePath(language)).toBe(path)
	})
})
