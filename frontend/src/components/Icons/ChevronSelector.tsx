import type { SVGProps } from 'react'
const SvgChevronSelector = (props: SVGProps<SVGSVGElement>) => (
	<svg xmlns='http://www.w3.org/2000/svg' width={15} height={15} fill='none' viewBox='0 0 15 15' {...props}>
		<path stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.125} d='M4.375 5.625 7.5 8.75l3.125-3.125' />
	</svg>
)
export default SvgChevronSelector
