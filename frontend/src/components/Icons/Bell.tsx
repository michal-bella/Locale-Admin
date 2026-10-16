import type { SVGProps } from 'react'
const SvgBell = (props: SVGProps<SVGSVGElement>) => (
	<svg xmlns='http://www.w3.org/2000/svg' width={18} height={18} fill='none' viewBox='0 0 18 18' {...props}>
		<path
			stroke='currentColor'
			strokeLinecap='round'
			strokeLinejoin='round'
			strokeWidth={1.35}
			d='M13.5 6a4.5 4.5 0 1 0-9 0c0 5.25-2.25 5.25-2.25 6.75h13.5c0-1.5-2.25-1.5-2.25-6.75M7.5 15.75h3'
		/>
	</svg>
)
export default SvgBell
