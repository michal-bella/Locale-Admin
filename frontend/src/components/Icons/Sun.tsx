import type { SVGProps } from 'react'
const SvgSun = (props: SVGProps<SVGSVGElement>) => (
	<svg xmlns='http://www.w3.org/2000/svg' width={24} height={24} fill='none' viewBox='0 0 24 24' {...props}>
		<circle cx={12} cy={12} r={4} stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.8} />
		<path
			stroke='currentColor'
			strokeLinecap='round'
			strokeLinejoin='round'
			strokeWidth={1.8}
			d='M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41'
		/>
	</svg>
)
export default SvgSun
