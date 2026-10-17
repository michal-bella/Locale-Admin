import { render } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'

import LanguageFlag from './LanguageFlag'

describe('LanguageFlag', () => {
	it('gives every flag instance its own mask id and references it', () => {
		const { container } = render(
			<>
				<LanguageFlag code='sk' size='lg' />
				<LanguageFlag code='sk' size='sm' />
				<LanguageFlag code='gb' size='lg' />
			</>,
		)

		const flags = Array.from(container.querySelectorAll('svg'))
		const maskIds = flags.map((flag) => flag.querySelector('mask')?.id)
		expect(new Set(maskIds).size).toBe(3)
		flags.forEach((flag, index) => {
			expect(maskIds[index]).toBeTruthy()
			expect(flag.querySelector('g')).toHaveAttribute('mask', `url(#${maskIds[index]})`)
		})
		expect(flags.map((flag) => flag.dataset.flag)).toEqual(['sk', 'sk', 'gb'])
	})
})
