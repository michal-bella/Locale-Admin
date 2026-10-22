import type { SVGProps } from 'react'
const SvgCheckCircle = (props: SVGProps<SVGSVGElement>) => (
	<svg xmlns='http://www.w3.org/2000/svg' width={16} height={16} fill='none' viewBox='0 0 16 16' {...props}>
		<path
			stroke='currentColor'
			strokeLinecap='round'
			strokeLinejoin='round'
			strokeWidth={1.2}
			d='M13.333 8A5.333 5.333 0 1 1 2.667 8a5.333 5.333 0 0 1 10.666 0'
		/>
		<path stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.2} d='m5.667 8 1.666 1.667 3-3.167' />
	</svg>
)
export default SvgCheckCircle
