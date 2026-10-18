import type { SVGProps } from 'react'
const SvgFile = (props: SVGProps<SVGSVGElement>) => (
	<svg xmlns='http://www.w3.org/2000/svg' width={17} height={17} fill='none' viewBox='0 0 17 17' {...props}>
		<path stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.275} d='M4.25 1.417h5.667L12.75 4.25v11.333h-8.5z' />
		<path stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.275} d='M9.917 1.417v3.541h3.541' />
	</svg>
)
export default SvgFile
