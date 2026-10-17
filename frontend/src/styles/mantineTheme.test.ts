import { describe, expect, it } from 'vite-plus/test'

import { mantineTheme } from '@/styles/mantineTheme'

describe('mantineTheme', () => {
	it('turns off Mantine transitions for users who prefer reduced motion', () => {
		expect(mantineTheme.respectReducedMotion).toBe(true)
	})
})
