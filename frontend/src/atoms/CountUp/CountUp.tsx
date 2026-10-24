import { useEffect, useRef, useState } from 'react'

import { type CountUpProps } from './types'

const DURATION_MS = 900

const easeOutCubic = (progress: number) => 1 - (1 - progress) ** 3

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Counts from 0 to `value` on mount and from the shown number to the new one when `value` changes; jumps straight there with reduced motion. */
const CountUp = ({ value, format = String }: CountUpProps) => {
	const [shown, setShown] = useState(() => (prefersReducedMotion() ? value : 0))
	const shownRef = useRef(shown)

	useEffect(() => {
		const from = shownRef.current
		if (from === value || prefersReducedMotion()) {
			shownRef.current = value
			setShown(value)
			return
		}
		const start = performance.now()
		let frame = 0
		const tick = (now: number) => {
			const progress = Math.min((now - start) / DURATION_MS, 1)
			shownRef.current = from + (value - from) * easeOutCubic(progress)
			setShown(shownRef.current)
			if (progress < 1) {
				frame = requestAnimationFrame(tick)
			}
		}
		frame = requestAnimationFrame(tick)
		return () => cancelAnimationFrame(frame)
	}, [value])

	return format(Math.round(shown))
}

export default CountUp
