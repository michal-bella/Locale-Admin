import { Text, Title } from '@mantine/core'
import { useId } from 'react'

import classes from './SectionCard.module.css'
import { type SectionCardProps } from './types'

/** Card with an h2 heading and a short description, as the Stav jazykov and Posledná aktivita sections of Figma 3:595. */
const SectionCard = ({ title, description, action, children }: SectionCardProps) => {
	const titleId = useId()

	return (
		<section aria-labelledby={titleId} className={classes.card}>
			<div className='flex flex-wrap items-center justify-between gap-3'>
				<div className='flex flex-col gap-1'>
					<Title id={titleId} order={2} fz='sm' lh='sm' c='var(--app-color-title)'>
						{title}
					</Title>
					<Text fz='xs' lh='xs' c='var(--app-color-muted)'>
						{description}
					</Text>
				</div>
				{action}
			</div>
			{children}
		</section>
	)
}

export default SectionCard
