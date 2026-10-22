import type { SVGProps } from 'react'
const SvgUser = (props: SVGProps<SVGSVGElement>) => (
	<svg xmlns='http://www.w3.org/2000/svg' width={16} height={16} fill='none' viewBox='0 0 16 16' {...props}>
		<path
			stroke='currentColor'
			strokeLinecap='round'
			strokeLinejoin='round'
			strokeWidth={1.2}
			d='M10.333 5.333a2.333 2.333 0 1 1-4.666 0 2.333 2.333 0 0 1 4.666 0M3.333 13.333c0-2.4 1.6-3.666 4.667-3.666s4.667 1.266 4.667 3.666'
		/>
	</svg>
)
export default SvgUser
