import type { SVGProps } from 'react'
const SvgChevronDown = (props: SVGProps<SVGSVGElement>) => (
	<svg xmlns='http://www.w3.org/2000/svg' width={10} height={6} fill='none' viewBox='0 0 10 6' {...props}>
		<path stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.5} d='m1 1 4 4 4-4' />
	</svg>
)
export default SvgChevronDown
