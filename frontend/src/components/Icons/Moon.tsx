import type { SVGProps } from 'react'
const SvgMoon = (props: SVGProps<SVGSVGElement>) => (
	<svg xmlns='http://www.w3.org/2000/svg' width={24} height={24} fill='none' viewBox='0 0 24 24' {...props}>
		<path stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.8} d='M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9' />
	</svg>
)
export default SvgMoon
