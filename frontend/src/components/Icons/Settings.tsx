import type { SVGProps } from 'react'
const SvgSettings = (props: SVGProps<SVGSVGElement>) => (
	<svg xmlns='http://www.w3.org/2000/svg' width={18} height={18} fill='none' viewBox='0 0 18 18' {...props}>
		<path stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.35} d='M11.25 9a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0' />
		<path
			stroke='currentColor'
			strokeLinecap='round'
			strokeLinejoin='round'
			strokeWidth={1.35}
			d='M14.55 11.25a1.5 1.5 0 0 0 .3 1.65l.075.075-1.95 1.95-.075-.075a1.5 1.5 0 0 0-2.298.243 1.5 1.5 0 0 0-.252.807v-.15h-2.7v-.15a1.5 1.5 0 0 0-2.55-1.05l-.075.075-1.95-1.95.075-.075a1.5 1.5 0 0 0 .3-1.65 1.5 1.5 0 0 0-1.2-.825V7.5h.15a1.5 1.5 0 0 0 1.452-1.77 1.5 1.5 0 0 0-.402-.78l-.075-.075 1.95-1.95L5.4 3a1.5 1.5 0 0 0 1.65 0 1.5 1.5 0 0 0 .9-1.5h2.55v.15a1.5 1.5 0 0 0 1.77 1.452 1.5 1.5 0 0 0 .78-.402l.075-.075 1.95 1.95L15 4.65a1.5 1.5 0 0 0 .243 2.298c.24.16.52.247.807.252h.15v2.55h-.15a1.5 1.5 0 0 0-1.5 1.5'
		/>
	</svg>
)
export default SvgSettings
