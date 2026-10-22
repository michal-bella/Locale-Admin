import type { SVGProps } from 'react'
const SvgClock = (props: SVGProps<SVGSVGElement>) => (
	<svg xmlns='http://www.w3.org/2000/svg' width={16} height={16} fill='none' viewBox='0 0 16 16' {...props}>
		<path
			stroke='currentColor'
			strokeLinecap='round'
			strokeLinejoin='round'
			strokeWidth={1.2}
			d='M13.333 8A5.333 5.333 0 1 1 2.667 8a5.333 5.333 0 0 1 10.666 0'
		/>
		<path stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.2} d='M8 5.333V8l1.667 1.667' />
	</svg>
)
export default SvgClock
