import type { SVGProps } from 'react'
const SvgAlertTriangle = (props: SVGProps<SVGSVGElement>) => (
	<svg xmlns='http://www.w3.org/2000/svg' width={16} height={16} fill='none' viewBox='0 0 16 16' {...props}>
		<path
			stroke='currentColor'
			strokeLinecap='round'
			strokeLinejoin='round'
			strokeWidth={1.25}
			d='M6.86 2.573 1.213 12a1.333 1.333 0 0 0 1.14 2h11.294a1.333 1.333 0 0 0 1.14-2L9.14 2.573a1.333 1.333 0 0 0-2.28 0M8 6v2.667M8 11.333h.007'
		/>
	</svg>
)
export default SvgAlertTriangle
