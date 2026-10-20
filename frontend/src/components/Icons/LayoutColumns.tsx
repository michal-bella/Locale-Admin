import type { SVGProps } from 'react'
const SvgLayoutColumns = (props: SVGProps<SVGSVGElement>) => (
	<svg xmlns='http://www.w3.org/2000/svg' width={15} height={15} fill='none' viewBox='0 0 15 15' {...props}>
		<rect width={11.25} height={10} x={1.875} y={2.5} stroke='currentColor' strokeWidth={1.125} rx={1.5} />
		<path stroke='currentColor' strokeLinecap='round' strokeWidth={1.125} d='M7.5 2.5v10' />
	</svg>
)
export default SvgLayoutColumns
