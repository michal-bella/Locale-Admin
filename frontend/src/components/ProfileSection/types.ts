import { type ReactNode } from 'react'

export type ProfileSectionProps = {
	title: string
	description: string
	/** Line between the header and the body. Without it the body follows the description 16 px below (Figma 3:1631). Defaults to `true`. */
	withDivider?: boolean
	children: ReactNode
}
