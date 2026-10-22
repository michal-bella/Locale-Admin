import type { SVGProps } from 'react'
const SvgTag = (props: SVGProps<SVGSVGElement>) => (
	<svg xmlns='http://www.w3.org/2000/svg' width={18} height={18} fill='none' viewBox='0 0 18 18' {...props}>
		<path
			stroke='currentColor'
			strokeLinecap='round'
			strokeLinejoin='round'
			strokeWidth={1.35}
			d='M6 6h.008M1.5 3.9v3.353c0 .367 0 .547.045.72.038.15.098.3.18.435.09.157.217.285.472.54L7.95 14.7c.9.9 1.35 1.35 1.868 1.515.45.15.952.15 1.402 0 .525-.165.975-.615 1.875-1.515l1.605-1.605c.9-.9 1.35-1.35 1.515-1.875.15-.45.15-.953 0-1.402C16.05 9.3 15.6 8.85 14.7 7.95L8.948 2.198c-.255-.256-.383-.383-.54-.473a1.6 1.6 0 0 0-.435-.18C7.8 1.5 7.62 1.5 7.253 1.5H3.9c-.84 0-1.26 0-1.582.165-.285.143-.51.368-.653.652C1.5 2.64 1.5 3.06 1.5 3.9'
		/>
	</svg>
)
export default SvgTag
