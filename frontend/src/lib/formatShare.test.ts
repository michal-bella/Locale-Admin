import { describe, expect, it } from 'vite-plus/test'

import { formatShare } from '@/lib/formatShare'

describe('formatShare', () => {
	it.each([
		[0, 0, { percent: '0\u00a0%' }],
		[0, 10, { percent: '0\u00a0%' }],
		[1, 3, { percent: '33\u00a0%' }],
		[10, 10, { percent: '100\u00a0%' }],
		[1, 224, { percent: '1\u00a0%', bound: 'lessThan' }],
		[223, 224, { percent: '99\u00a0%', bound: 'moreThan' }],
	])('formats %i of %i', (part, total, expected) => {
		expect(formatShare(part, total, 'sk')).toEqual(expected)
	})

	it('uses the format of the UI language', () => {
		expect(formatShare(1, 2, 'en')).toEqual({ percent: '50%' })
	})
})
