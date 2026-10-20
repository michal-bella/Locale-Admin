import type { SVGProps } from 'react'
const SvgDownload = (props: SVGProps<SVGSVGElement>) => (
	<svg xmlns='http://www.w3.org/2000/svg' width={16} height={16} fill='none' viewBox='0 0 16 16' {...props}>
		<g stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.2}>
			<path d='M8 2v8M4.667 6.667 8 10l3.333-3.333M3.333 14h9.334' />
		</g>
	</svg>
)
export default SvgDownload
