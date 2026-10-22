import type { SVGProps } from 'react'
const SvgFolder = (props: SVGProps<SVGSVGElement>) => (
	<svg xmlns='http://www.w3.org/2000/svg' width={16} height={16} fill='none' viewBox='0 0 16 16' {...props}>
		<path
			stroke='currentColor'
			strokeLinecap='round'
			strokeLinejoin='round'
			strokeWidth={1.2}
			d='M2 4.667c0-.737.597-1.334 1.333-1.334h2.4l1.6 1.6h5.334c.736 0 1.333.597 1.333 1.334v5.4c0 .736-.597 1.333-1.333 1.333H3.333A1.333 1.333 0 0 1 2 11.667z'
		/>
	</svg>
)
export default SvgFolder
