import { type ReactNode } from 'react'

export type SectionCardProps = {
	title: string
	description: string
	/** Top right of the card, e.g. a link or a range switch. */
	action?: ReactNode
	children: ReactNode
}
