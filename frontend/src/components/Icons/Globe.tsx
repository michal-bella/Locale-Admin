import type { SVGProps } from 'react'
const SvgGlobe = (props: SVGProps<SVGSVGElement>) => (
	<svg xmlns='http://www.w3.org/2000/svg' width={18} height={18} fill='none' viewBox='0 0 18 18' {...props}>
		<path
			stroke='currentColor'
			strokeLinecap='round'
			strokeLinejoin='round'
			strokeWidth={1.35}
			d='M15.75 9a6.75 6.75 0 1 1-13.5 0 6.75 6.75 0 0 1 13.5 0'
		/>
		<path
			stroke='currentColor'
			strokeLinecap='round'
			strokeLinejoin='round'
			strokeWidth={1.35}
			d='M2.25 9h5.063m0 0h3.375M7.312 9c0-2.812.563-5.625 1.688-6.75 1.125 1.125 1.688 3.938 1.688 6.75M7.312 9c0 2.813.563 5.625 1.688 6.75 1.125-1.125 1.688-3.937 1.688-6.75m0 0h5.062'
		/>
	</svg>
)
export default SvgGlobe
